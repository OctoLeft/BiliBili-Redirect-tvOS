import fs from "node:fs";
import process from "node:process";
import vm from "node:vm";

const requestBundle = fs.readFileSync(new URL("../dist/request.bundle.js", import.meta.url), "utf8");
const responseBundle = fs.readFileSync(new URL("../dist/response.bundle.js", import.meta.url), "utf8");

const defaultPlayurlAPI = "https://api.bilibili.com/x/player/playurl?avid=455017605&cid=168409646&qn=64&fnval=16&fourk=1";
const defaultReferer = "https://www.bilibili.com/video/BV1Q541167Qg";
const defaultArgument = [
	"Storage=Argument",
	"LogLevel=ERROR",
	"Host.AkamaiCNHK=cn-hk-eq-01-03.bilivideo.com",
	"Host.AkamaiCNHKPool=cn-hk-eq-01-03.bilivideo.com,cn-hk-eq-01-13.bilivideo.com,cn-hk-eq-01-12.bilivideo.com,cn-hk-eq-01-01.bilivideo.com",
].join("&");
const persistentStore = new Map();

function getFlag(name) {
	const index = process.argv.indexOf(name);
	return index >= 0 ? process.argv[index + 1] : "";
}

function hostOf(value) {
	try {
		return new URL(value).hostname;
	} catch {
		return "";
	}
}

function queryParamOf(value, name) {
	try {
		return new URL(value).searchParams.get(name) ?? "";
	} catch {
		return "";
	}
}

function hasSignedHDNTS(value) {
	return /[?&]hdnts=exp(?:=|%3D)\d+~hmac(?:=|%3D)/u.test(value);
}

function playbackDeadlineOf(value) {
	const deadline = Number(queryParamOf(value, "deadline"));
	return Number.isFinite(deadline) && deadline > 0 ? deadline * 1000 : 0;
}

function isAkamaiHost(host) {
	return host === "upos-hz-mirrorakam.akamaized.net";
}

function isCNHKHost(host) {
	return /^cn-hk-eq-\d{2}-\d{2}\.bilivideo\.com$/u.test(host);
}

function isMediaURL(value) {
	return typeof value === "string" && /^https?:\/\//u.test(value) && value.includes("/upgcxcode/");
}

function collectMediaURLs(node, urls = []) {
	if (isMediaURL(node)) {
		urls.push(node);
		return urls;
	}
	if (Array.isArray(node)) {
		for (const item of node) collectMediaURLs(item, urls);
		return urls;
	}
	if (!node || typeof node !== "object") return urls;

	for (const key of ["baseUrl", "base_url", "url"]) {
		if (isMediaURL(node[key])) urls.push(node[key]);
	}
	for (const value of Object.values(node)) collectMediaURLs(value, urls);
	return urls;
}

function collectMediaEntries(node, entries = []) {
	if (Array.isArray(node)) {
		for (const item of node) collectMediaEntries(item, entries);
		return entries;
	}
	if (!node || typeof node !== "object") return entries;

	const url = ["baseUrl", "base_url", "url"].map(key => node[key]).find(isMediaURL);
	if (url) {
		entries.push({
			url,
			backups: [
				...(Array.isArray(node.backupUrl) ? node.backupUrl : []),
				...(Array.isArray(node.backup_url) ? node.backup_url : []),
				...(Array.isArray(node.backupUrls) ? node.backupUrls : []),
				...(Array.isArray(node.backup_urls) ? node.backup_urls : []),
			].filter(isMediaURL),
		});
	}
	for (const value of Object.values(node)) collectMediaEntries(value, entries);
	return entries;
}

function createHTTPClient() {
	async function request(resource, callback) {
		const controller = new AbortController();
		const timeout = Number(resource.timeout || 5) * 1000;
		const timer = setTimeout(() => controller.abort(), timeout);
		try {
			const response = await fetch(resource.url, {
				method: resource.method ?? "GET",
				headers: resource.headers ?? {},
				body: resource.body,
				redirect: resource["auto-redirect"] === false ? "manual" : "follow",
				signal: controller.signal,
			});
			const headers = Object.fromEntries(response.headers.entries());
			const body = await response.text();
			callback(null, { status: response.status, headers }, body);
		} catch (error) {
			callback(error);
		} finally {
			clearTimeout(timer);
		}
	}
	return {
		get(resource, callback) {
			request({ ...resource, method: "GET" }, callback);
		},
		post(resource, callback) {
			request({ ...resource, method: "POST" }, callback);
		},
		put(resource, callback) {
			request({ ...resource, method: "PUT" }, callback);
		},
		delete(resource, callback) {
			request({ ...resource, method: "DELETE" }, callback);
		},
	};
}

function runSurgeBundle(code, globals) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Surge bundle did not call $done in time")), 10000);
		const context = {
			console: { log() {} },
			setTimeout,
			clearTimeout,
			TextDecoder,
			TextEncoder,
			$httpClient: createHTTPClient(),
			$argument: defaultArgument,
			$environment: { "surge-version": "9.0" },
			$persistentStore: {
				read(key) {
					return persistentStore.get(key) ?? "";
				},
				write(value, key) {
					persistentStore.set(key, value);
					return true;
				},
			},
			$script: { startTime: Date.now() / 1000 },
			$done(value) {
				clearTimeout(timer);
				resolve(value);
			},
			...globals,
		};
		try {
			vm.createContext(context);
			vm.runInContext(code, context, { timeout: 5000 });
		} catch (error) {
			clearTimeout(timer);
			reject(error);
		}
	});
}

async function runResponseScript(apiURL, bodyText) {
	return runSurgeBundle(responseBundle, {
		$request: { method: "GET", url: apiURL, headers: {} },
		$response: {
			headers: {
				"Content-Type": "application/json",
				"Content-Length": String(Buffer.byteLength(bodyText)),
			},
			body: bodyText,
		},
	});
}

async function runRequestScript(inputURL, range = "bytes=0-1023") {
	const requestURL = new URL(inputURL);
	const result = await runSurgeBundle(requestBundle, {
		$request: {
			method: "GET",
			url: inputURL,
			headers: {
				Host: requestURL.host,
				Referer: defaultReferer,
				Range: range,
				"User-Agent": "Bilibili Freedoooooom/MarkII",
			},
		},
	});
	const response = result?.response;
	if (response?.headers?.Location) return { url: response.headers.Location, headers: {}, syntheticStatus: response.status };
	return { url: result.url, headers: result.headers ?? {}, syntheticStatus: 0 };
}

function getHeader(headers, name) {
	const key = Object.keys(headers ?? {}).find(item => item.toLowerCase() === name.toLowerCase());
	return key ? headers[key] : "";
}

async function probeURL(url, requestHeaders = {}, range = "bytes=0-1023") {
	const response = await fetch(url, {
		headers: {
			Accept: "*/*",
			Range: range,
			"User-Agent": getHeader(requestHeaders, "User-Agent") || "Bilibili Freedoooooom/MarkII",
			...(getHeader(requestHeaders, "Referer") ? { Referer: getHeader(requestHeaders, "Referer") } : {}),
		},
		redirect: "manual",
	});
	return {
		status: response.status,
		contentRange: response.headers.get("content-range") ?? "",
		server: response.headers.get("x-server") ?? response.headers.get("server") ?? "",
	};
}

async function runFreshPlayurlTest() {
	const apiURL = getFlag("--playurl-api") || process.env.BILI_PLAYURL_API || defaultPlayurlAPI;
	const playurlResponse = await fetch(apiURL, {
		headers: {
			Referer: defaultReferer,
			"User-Agent": "Mozilla/5.0",
		},
	});
	const bodyText = await playurlResponse.text();
	const originalBody = JSON.parse(bodyText);
	if (originalBody.code !== 0) throw new Error(`playurl API failed: ${bodyText.slice(0, 300)}`);

	const originalMediaURLs = collectMediaURLs(originalBody);
	const originalMediaURL = originalMediaURLs[0];
	const originalAkamaiURL = originalMediaURLs.find(value => isAkamaiHost(hostOf(value)));
	const rewrittenResponse = await runResponseScript(apiURL, bodyText);
	const rewrittenBody = JSON.parse(rewrittenResponse.body);
	const rewrittenMediaEntry = collectMediaEntries(rewrittenBody)[0];
	const rewrittenMediaURL = rewrittenMediaEntry?.url;
	if (!rewrittenMediaURL) throw new Error("response script did not leave any media URL to test");

	const requestResult = await runRequestScript(rewrittenMediaURL);
	const probe = await probeURL(requestResult.url, requestResult.headers);
	const lane1Range = "bytes=524288-525311";
	const lane1Result = await runRequestScript(rewrittenMediaURL, lane1Range);
	const lane1Probe = await probeURL(lane1Result.url, lane1Result.headers, lane1Range);
	const backupHosts = rewrittenMediaEntry.backups.map(hostOf);
	const cnhkBackupCount = backupHosts.filter(isCNHKHost).length;

	console.log(`fresh.playurl.before=${hostOf(originalMediaURL)}`);
	console.log(`fresh.playurl.after=${hostOf(rewrittenMediaURL)}`);
	console.log(`fresh.playurl.backupCNHK=${cnhkBackupCount}`);
	console.log(`fresh.playurl.backupAkamai=${backupHosts.includes("upos-hz-mirrorakam.akamaized.net") ? "true" : "false"}`);
	console.log(`fresh.request.final=${hostOf(requestResult.url)}`);
	console.log(`fresh.request.status=${probe.status}`);
	console.log(`fresh.request.contentRange=${probe.contentRange}`);
	console.log(`fresh.request.server=${probe.server}`);
	console.log(`fresh.request.build=${queryParamOf(requestResult.url, "build")}`);
	console.log(`fresh.request.buvid=${queryParamOf(requestResult.url, "buvid") ? "present" : "empty"}`);
	console.log(`fresh.request.hdntsSigned=${hasSignedHDNTS(requestResult.url) ? "true" : "false"}`);
	console.log(`fresh.sticky0.final=${hostOf(requestResult.url)}`);
	console.log(`fresh.sticky1.final=${hostOf(lane1Result.url)}`);
	console.log(`fresh.sticky1.status=${lane1Probe.status}`);

	if (probe.status === 403 || probe.status >= 400) throw new Error(`fresh playurl final request returned ${probe.status}`);
	if (lane1Probe.status === 403 || lane1Probe.status >= 400) throw new Error(`fresh sticky range request returned ${lane1Probe.status}`);
	if (!isCNHKHost(hostOf(rewrittenMediaURL))) throw new Error("fresh playurl response was not rewritten to CNHK");
	if (!isCNHKHost(hostOf(requestResult.url))) throw new Error("fresh final request was not CNHK");
	if (!isCNHKHost(hostOf(lane1Result.url))) throw new Error("fresh sticky range final request was not CNHK");
	if (cnhkBackupCount < 2) throw new Error("fresh playurl did not include enough CNHK backups");
	if (hostOf(lane1Result.url) !== hostOf(requestResult.url)) throw new Error("fresh request host was not sticky across ranges");
	if (!backupHosts.includes("upos-hz-mirrorakam.akamaized.net")) throw new Error("fresh playurl did not keep Akamai fallback");

	if (originalAkamaiURL) {
		const fallbackResult = await runRequestScript(originalAkamaiURL);
		const fallbackProbe = await probeURL(fallbackResult.url, fallbackResult.headers);
		console.log(`fresh.akamaiFallback.final=${hostOf(fallbackResult.url)}`);
		console.log(`fresh.akamaiFallback.status=${fallbackProbe.status}`);
		if (!isCNHKHost(hostOf(fallbackResult.url))) throw new Error("fresh Akamai fallback was not rewritten to CNHK");
		if (fallbackProbe.status === 403 || fallbackProbe.status >= 400) throw new Error(`fresh Akamai fallback returned ${fallbackProbe.status}`);
	}
}

async function runProvidedURLTest() {
	const providedURL = getFlag("--url") || process.env.BILI_TEST_URL;
	if (!providedURL) return;
	const deadline = playbackDeadlineOf(providedURL);
	if ((process.env.BILI_STRICT_URL === "1" || process.argv.includes("--strict-url")) && deadline && deadline < Date.now()) {
		console.log(`provided.request.input=${hostOf(providedURL)}`);
		console.log(`provided.request.skipped=expired`);
		console.log(`provided.request.deadline=${new Date(deadline).toISOString()}`);
		return;
	}
	const requestResult = await runRequestScript(providedURL);
	const probe = await probeURL(requestResult.url, requestResult.headers);

	console.log(`provided.request.input=${hostOf(providedURL)}`);
	console.log(`provided.request.final=${hostOf(requestResult.url)}`);
	console.log(`provided.request.status=${probe.status}`);
	console.log(`provided.request.server=${probe.server}`);
	console.log(`provided.request.build=${queryParamOf(requestResult.url, "build")}`);
	console.log(`provided.request.buvid=${queryParamOf(requestResult.url, "buvid") ? "present" : "empty"}`);
	console.log(`provided.request.hdntsSigned=${hasSignedHDNTS(requestResult.url) ? "true" : "false"}`);

	if ((process.env.BILI_STRICT_URL === "1" || process.argv.includes("--strict-url")) && (probe.status === 403 || probe.status >= 400)) {
		throw new Error(`provided URL final request returned ${probe.status}`);
	}
	if ((process.env.BILI_STRICT_URL === "1" || process.argv.includes("--strict-url")) && isAkamaiHost(hostOf(providedURL)) && !isCNHKHost(hostOf(requestResult.url))) {
		throw new Error("provided Akamai request was not rewritten to CNHK");
	}
}

await runFreshPlayurlTest();
await runProvidedURLTest();
