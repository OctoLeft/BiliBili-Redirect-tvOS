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
	"TVOS.RedirectMode=response-only",
	"Host.AkamaiCNHK=cn-hk-eq-01-03.bilivideo.com",
].join("&");

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

function isMediaURL(value) {
	return typeof value === "string" && /^https?:\/\//u.test(value) && value.includes("/upgcxcode/");
}

function collectMediaURLs(node, urls = []) {
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

function runSurgeBundle(code, globals) {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error("Surge bundle did not call $done in time")), 5000);
		const context = {
			console: { log() {} },
			TextDecoder,
			TextEncoder,
			$argument: defaultArgument,
			$environment: { "surge-version": "9.0" },
			$persistentStore: {
				read() {
					return "";
				},
				write() {
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

async function runRequestScript(inputURL) {
	const requestURL = new URL(inputURL);
	const result = await runSurgeBundle(requestBundle, {
		$request: {
			method: "GET",
			url: inputURL,
			headers: {
				Host: requestURL.host,
				Referer: defaultReferer,
				Range: "bytes=0-1023",
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

async function probeURL(url, requestHeaders = {}) {
	const response = await fetch(url, {
		headers: {
			Accept: "*/*",
			Range: "bytes=0-1023",
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

	const originalMediaURL = collectMediaURLs(originalBody)[0];
	const rewrittenResponse = await runResponseScript(apiURL, bodyText);
	const rewrittenBody = JSON.parse(rewrittenResponse.body);
	const rewrittenMediaURL = collectMediaURLs(rewrittenBody)[0];
	if (!rewrittenMediaURL) throw new Error("response script did not leave any media URL to test");

	const requestResult = await runRequestScript(rewrittenMediaURL);
	const probe = await probeURL(requestResult.url, requestResult.headers);

	console.log(`fresh.playurl.before=${hostOf(originalMediaURL)}`);
	console.log(`fresh.playurl.after=${hostOf(rewrittenMediaURL)}`);
	console.log(`fresh.request.final=${hostOf(requestResult.url)}`);
	console.log(`fresh.request.status=${probe.status}`);
	console.log(`fresh.request.contentRange=${probe.contentRange}`);
	console.log(`fresh.request.server=${probe.server}`);

	if (probe.status === 403 || probe.status >= 400) throw new Error(`fresh playurl final request returned ${probe.status}`);
}

async function runProvidedURLTest() {
	const providedURL = getFlag("--url") || process.env.BILI_TEST_URL;
	if (!providedURL) return;
	const requestResult = await runRequestScript(providedURL);
	const probe = await probeURL(requestResult.url, requestResult.headers);

	console.log(`provided.request.input=${hostOf(providedURL)}`);
	console.log(`provided.request.final=${hostOf(requestResult.url)}`);
	console.log(`provided.request.status=${probe.status}`);
	console.log(`provided.request.server=${probe.server}`);

	if ((process.env.BILI_STRICT_URL === "1" || process.argv.includes("--strict-url")) && (probe.status === 403 || probe.status >= 400)) {
		throw new Error(`provided URL final request returned ${probe.status}`);
	}
}

await runFreshPlayurlTest();
await runProvidedURLTest();
