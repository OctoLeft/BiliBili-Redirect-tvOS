import { $app, Console, done, Lodash as _ } from "@nsnanocat/util";
import { URL } from "@nsnanocat/url";
import database from "./function/database.mjs";
import setENV from "./function/setENV.mjs";
// 构造回复数据
// biome-ignore lint/style/useConst: <explanation>
let $response = undefined;
/***************** Processing *****************/
// 解构URL
const RAW_URL = $request.url;
const url = new URL($request.url);
Console.info(`url: ${url.toJSON()}`);
// 获取连接参数
const PATHs = url.pathname.split("/").filter(Boolean);
Console.info(`PATHs: ${PATHs}`);
// 解析格式
const FORMAT = ($request.headers?.["Content-Type"] ?? $request.headers?.["content-type"])?.split(";")?.[0];
Console.info(`FORMAT: ${FORMAT}`);

const TVOS_BUVID_CACHE_KEY = "@BiliBili.Redirect.Caches.tvOS.Buvid";
const TVOS_CNHK_PROBE_CACHE_KEY = "@BiliBili.Redirect.Caches.tvOS.CNHKProbe";
const TVOS_CNHK_PROBE_CACHE_TTL = 10 * 60 * 1000;
let preserveRawURL = false;
let finalRawURL = "";

function getHeaderKey(headers, name) {
	const lowerName = name.toLowerCase();
	return Object.keys(headers ?? {}).find(key => key.toLowerCase() === lowerName);
}

function setHeader(headers, name, value) {
	const key = getHeaderKey(headers, name) ?? name;
	headers[key] = value;
}

function escapeRegExp(value) {
	return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function rawURLHost(rawURL) {
	const match = rawURL.match(/^[a-z][a-z\d+.-]*:\/\/([^/?#]+)/iu);
	return match?.[1] ?? "";
}

function rawURLPathname(rawURL) {
	const match = rawURL.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]+([^?#]*)/iu);
	return match?.[1] ?? "";
}

function getRawQueryParam(rawURL, name) {
	const match = rawURL.match(new RegExp(`[?&]${escapeRegExp(name)}=([^&#]*)`, "u"));
	return match?.[1] ?? "";
}

function setRawQueryParam(rawURL, name, value) {
	const hashIndex = rawURL.indexOf("#");
	const hash = hashIndex >= 0 ? rawURL.slice(hashIndex) : "";
	const urlWithoutHash = hashIndex >= 0 ? rawURL.slice(0, hashIndex) : rawURL;
	const queryIndex = urlWithoutHash.indexOf("?");
	const encodedValue = encodeURIComponent(value);
	if (queryIndex < 0) return `${urlWithoutHash}?${encodeURIComponent(name)}=${encodedValue}${hash}`;

	const beforeQuery = urlWithoutHash.slice(0, queryIndex + 1);
	const query = urlWithoutHash.slice(queryIndex + 1);
	const parts = query.split("&");
	let changed = false;
	for (let i = 0; i < parts.length; i++) {
		const key = parts[i].split("=", 1)[0];
		if (key === name) {
			parts[i] = `${key}=${encodedValue}`;
			changed = true;
		}
	}
	if (!changed) parts.push(`${encodeURIComponent(name)}=${encodedValue}`);
	return `${beforeQuery}${parts.join("&")}${hash}`;
}

function rewriteRawURLAuthority(rawURL, protocol, host) {
	return rawURL.replace(/^[a-z][a-z\d+.-]*:\/\/[^/?#]+/iu, `${protocol}//${host}`);
}

function setFinalRawURL(rawURL) {
	finalRawURL = rawURL;
	preserveRawURL = true;
}

function readPersistentValue(key) {
	try {
		if (typeof $persistentStore === "undefined") return "";
		return $persistentStore.read(key) ?? "";
	} catch (e) {
		Console.warn(`读取持久化缓存失败: ${e}`);
		return "";
	}
}

function writePersistentValue(key, value) {
	try {
		if (typeof $persistentStore === "undefined") return;
		$persistentStore.write(value, key);
	} catch (e) {
		Console.warn(`写入持久化缓存失败: ${e}`);
	}
}

function randomAlphaNumeric(length) {
	const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	let value = "";
	for (let i = 0; i < length; i++) value += chars[Math.floor(Math.random() * chars.length)];
	return value;
}

function getTVOSBuvid(Settings) {
	const configuredBuvid = Settings.TVOS?.Buvid?.trim();
	if (configuredBuvid) return configuredBuvid;
	const cachedBuvid = readPersistentValue(TVOS_BUVID_CACHE_KEY);
	if (cachedBuvid) return cachedBuvid;
	const generatedBuvid = `YF${randomAlphaNumeric(42)}`;
	writePersistentValue(TVOS_BUVID_CACHE_KEY, generatedBuvid);
	return generatedBuvid;
}

function getRawSignedParamNames(rawURL) {
	try {
		const value = decodeURIComponent(getRawQueryParam(rawURL, "uparams"));
		return new Set(value.split(",").filter(Boolean));
	} catch {
		return new Set(getRawQueryParam(rawURL, "uparams").split(",").filter(Boolean));
	}
}

function isCNHKHost(host) {
	return /^cn-hk-eq-\d{2}-\d{2}\.bilivideo\.com$/u.test(host);
}

function getFallbackCNHKHost(Settings) {
	const configuredHost = Settings.Host?.AkamaiCNHK;
	return isCNHKHost(configuredHost) ? configuredHost : "cn-hk-eq-01-03.bilivideo.com";
}

function readCachedCNHKHosts(rawURL) {
	try {
		const value = readPersistentValue(TVOS_CNHK_PROBE_CACHE_KEY);
		if (!value) return [];
		const cache = JSON.parse(value);
		if (Date.now() - Number(cache.updatedAt ?? 0) > TVOS_CNHK_PROBE_CACHE_TTL) return [];
		const pathname = rawURLPathname(rawURL);
		const entries = Array.isArray(cache.entries) ? cache.entries : [];
		const entry = entries.find(item => item?.pathname === pathname);
		if (entry) return Array.isArray(entry.hosts) ? entry.hosts.filter(isCNHKHost) : [];
		if (cache.pathname === pathname) return Array.isArray(cache.hosts) ? cache.hosts.filter(isCNHKHost) : [];
		return [];
	} catch (e) {
		Console.warn(`读取 CNHK 节点缓存失败: ${e}`);
		return [];
	}
}

function getRequestCNHKHost(Settings) {
	return readCachedCNHKHosts(RAW_URL)[0] || getFallbackCNHKHost(Settings);
}

function applyTVOSCNHKHeaders(Settings) {
	if (!$request.headers) $request.headers = {};
	setHeader($request.headers, "User-Agent", Settings.TVOS?.UserAgent || "Bilibili Freedoooooom/MarkII");
	if (!getHeaderKey($request.headers, "Referer")) setHeader($request.headers, "Referer", "https://www.bilibili.com");
}

function applyTVOSAkamaiHeaders(Settings) {
	if (!$request.headers) $request.headers = {};
	setHeader($request.headers, "User-Agent", Settings.TVOS?.UserAgent || "Bilibili Freedoooooom/MarkII");
	if (!getHeaderKey($request.headers, "Referer")) setHeader($request.headers, "Referer", "https://www.bilibili.com");
}

function isResponseOnlyMode() {
	return true;
}

function isSignedPlaybackURL(url) {
	return url.pathname.startsWith("/upgcxcode/") && Boolean(url.searchParams.get("upsig"));
}

function preserveSignedPlaybackRequest(Settings) {
	setFinalRawURL(RAW_URL);
	applyTVOSAkamaiHeaders(Settings);
}

function isTVOSCNHKAkamaiURL(url, Settings) {
	return isCNHKHost(url.hostname) && url.searchParams.get("os") === "akam";
}

function prepareTVOSAkamaiRequest(Settings) {
	const akamaiURL = buildTVOSCNHKURL(RAW_URL, Settings, getRequestCNHKHost(Settings));
	setFinalRawURL(akamaiURL);
	applyTVOSCNHKHeaders(Settings);
}

function buildTVOSCNHKURL(rawURL, Settings, host) {
	const signedParams = getRawSignedParamNames(rawURL);
	let nextURL = rewriteRawURLAuthority(rawURL, "http:", host);
	if (!signedParams.has("buvid") && !getRawQueryParam(nextURL, "buvid")) nextURL = setRawQueryParam(nextURL, "buvid", getTVOSBuvid(Settings));
	const build = getRawQueryParam(nextURL, "build");
	if (!signedParams.has("build") && (!build || build === "0")) nextURL = setRawQueryParam(nextURL, "build", Settings.TVOS?.Build || "89600100");
	return nextURL;
}

(async () => {
	/**
	 * 设置
	 * @type {{Settings: import('./types').Settings}}
	 */
	const { Settings, Caches, Configs } = setENV("BiliBili", "Redirect", database);
	Console.logLevel = Settings.LogLevel;
	// 创建空数据
	const body = {};
	// 方法判断
	switch ($request.method) {
		case "POST":
		case "PUT":
		case "PATCH":
		// biome-ignore lint/suspicious/noFallthroughSwitchClause: <explanation>
		case "DELETE":
			// 格式判断
			switch (FORMAT) {
				case undefined: // 视为无body
					break;
				case "application/x-www-form-urlencoded":
				case "text/plain":
				default:
					break;
				case "application/x-mpegURL":
				case "application/x-mpegurl":
				case "application/vnd.apple.mpegurl":
				case "audio/mpegurl":
					//body = M3U8.parse($request.body);
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = M3U8.stringify(body);
					break;
				case "text/xml":
				case "text/html":
				case "text/plist":
				case "application/xml":
				case "application/plist":
				case "application/x-plist":
					//body = XML.parse($request.body);
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = XML.stringify(body);
					break;
				case "text/vtt":
				case "application/vtt":
					//body = VTT.parse($request.body);
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = VTT.stringify(body);
					break;
				case "text/json":
				case "application/json":
					//body = JSON.parse($request.body ?? "{}");
					//Console.debug(`body: ${JSON.stringify(body)}`);
					//$request.body = JSON.stringify(body);
					break;
				case "application/protobuf":
				case "application/x-protobuf":
				case "application/vnd.google.protobuf":
				case "application/grpc":
				case "application/grpc+proto":
				case "application/vnd.apple.flatbuffer":
				case "application/octet-stream": {
					//Console.debug(`$request.body: ${JSON.stringify($request.body)}`);
					// biome-ignore lint/style/useConst: <explanation>
					let rawBody = $app === "Quantumult X" ? new Uint8Array($request.bodyBytes ?? []) : ($request.body ?? new Uint8Array());
					//Console.debug(`isBuffer? ${ArrayBuffer.isView(rawBody)}: ${JSON.stringify(rawBody)}`);
					switch (FORMAT) {
						case "application/protobuf":
						case "application/x-protobuf":
						case "application/vnd.google.protobuf":
							break;
						case "application/grpc":
						case "application/grpc+proto":
							break;
					}
					// 写入二进制数据
					$request.body = rawBody;
					break;
				}
			}
		//break; // 不中断，继续处理URL
		case "GET":
		case "HEAD":
		case "OPTIONS":
		default:
			// 主机判断
			switch (url.hostname) {
				case "upos-sz-mirrorali.bilivideo.com": // 阿里云 CDN
				case "upos-sz-mirrorali02.bilivideo.com": // 阿里云 CDN
				case "upos-sz-mirroralib.bilivideo.com": // 阿里云 CDN
				case "upos-sz-mirroralio1.bilivideo.com": // 阿里云 CDN
				case "upos-sz-mirrorcos.bilivideo.com": // 腾讯云 CDN
				case "upos-sz-mirrorcosb.bilivideo.com": // 腾讯云 CDN，VOD 加速类型
				case "upos-sz-mirrorcoso1.bilivideo.com": // 腾讯云 CDN
				case "upos-sz-mirrorhw.bilivideo.com": // 华为云 CDN，融合 CDN
				case "upos-sz-mirrorhwb.bilivideo.com": // 华为云 CDN，融合 CDN
				case "upos-sz-mirrorhwo1.bilivideo.com": // 华为云 CDN，融合 CDN
				case "upos-sz-mirror08c.bilivideo.com": // 华为云 CDN，融合 CDN
				case "upos-sz-mirror08h.bilivideo.com": // 华为云 CDN，融合 CDN
				case "upos-sz-mirror08ct.bilivideo.com": // 华为云 CDN，融合 CDN
				break;
				case "upos-hz-mirrorakam.akamaized.net": // tvOS Akamai CDN，保留签名查询并透明改写到 CNHK。
					prepareTVOSAkamaiRequest(Settings);
					break;
				case "upos-sz-mirrorawsov.bilivideo.com": // AWS CDN，海外
				case "upos-sz-mirroraliov.bilivideo.com": // 阿里云 CDN，海外
				case "upos-sz-mirrorcosov.bilivideo.com": // 腾讯云 CDN，海外
				case "upos-sz-mirrorhwov.bilivideo.com": // 华为云 CDN，海外
					if (isResponseOnlyMode() && isSignedPlaybackURL(url)) preserveSignedPlaybackRequest(Settings);
					else url.hostname = Settings.Host.OverseaVideo;
					break;
				case "upos-sz-mirroralibstar1.bilivideo.com": // 阿里云 CDN，海外（东南亚），其他类型的 CDN 应该不能替换为此 Host，但反过来可以。
				case "upos-sz-mirrorcosbstar1.bilivideo.com": // 腾讯云 CDN，海外（东南亚），其他类型的 CDN 应该不能替换为此 Host，但反过来可以。
				case "upos-sz-mirrorhwbstar1.bilivideo.com": // 华为云 CDN，海外（东南亚），其他类型的 CDN 应该不能替换为此 Host，但反过来可以。
				case "upos-bstar1-mirrorakam.akamaized.net": // Akamai CDN，海外（东南亚），有参数校验，其他类型的 CDN 不能直接替换为此 Host。但反过来可以。
					url.hostname = Settings.Host.BStar;
					break;
				default:
					if (isTVOSCNHKAkamaiURL(url, Settings)) {
						setFinalRawURL(buildTVOSCNHKURL(RAW_URL, Settings, url.hostname));
						applyTVOSCNHKHeaders(Settings);
					}
					switch (url.port) {
						case "": {
							switch (true) {
								case url.hostname.endsWith(".mcdn.bilivideo.cn"):
									switch (true) {
										case url.pathname.startsWith("/v1/resource/"):
											switch (url.protocol) {
												case "http:":
													url.port = "8000";
													break;
												case "https:":
													url.port = "8082";
													break;
											}
											break;
										case url.pathname.startsWith("/upgcxcode/"):
											switch (url.protocol) {
												case "http:":
													url.port = "9102";
													break;
												case "https:":
													url.port = "4483";
													break;
											}
											break;
									}
									break;
							}
							break;
						}
						case "486": {
							// MCDN
							const cdn = url.searchParams.get("cdn");
							const sid = url.searchParams.get("sid");
							if (cdn) {
								url.hostname = `d1--${cdn}.bilivideo.com`;
								url.port = "";
							} else if (sid) {
								url.hostname = `${sid}.bilivideo.com`;
								url.port = "";
							}
							break;
						}
						case "4480": // PCDN
							url.protocol = "http:";
							url.hostname = url.searchParams.get("xy_usource") || Settings.Host.PCDN;
							url.port = "";
							break;
							case "8000": // MCDN.v1.resource
							case "8082": // MCDN.v1.resource
								break;
							case "4483": // MCDN.upgcxcode
							case "9102": // MCDN.upgcxcode
							if (url.searchParams.has("originalUrl")) break; // 跳过 MCDN 重定向
							url.protocol = "http:";
							url.hostname = Settings.Host.MCDN;
							url.port = "";
							url.pathname = "";
							for (const key of url.searchParams.keys()) url.searchParams.delete(key);
							url.searchParams.set("url", $request.url);
							break;
						case "9305": // PCDN
							url.protocol = "http:";
							url.hostname = url.PATHs.shift();
							url.port = "";
							url.pathname = url.PATHs.join("/");
							break;
					}
					break;
			}
			break;
		case "CONNECT":
		case "TRACE":
			break;
	}
	if (!$request.headers) $request.headers = {};
	const finalURL = finalRawURL || (preserveRawURL ? RAW_URL : url.toString());
	const finalHost = finalRawURL ? rawURLHost(finalRawURL) : url.host;
	setHeader($request.headers, "Host", finalHost);
	if ($request.headers?.[":authority"]) $request.headers[":authority"] = finalHost;
	$request.url = finalURL;
	Console.debug(`$request.url: ${$request.url}`);
})()
	.catch(e => Console.error(e))
	.finally(() => {
		switch (typeof $response) {
			case "object": // 有构造回复数据，返回构造的回复数据
				//Console.debug("finally", `echo $response: ${JSON.stringify($response, null, 2)}`);
				if ($response.headers?.["Content-Encoding"]) $response.headers["Content-Encoding"] = "identity";
				if ($response.headers?.["content-encoding"]) $response.headers["content-encoding"] = "identity";
				switch ($app) {
					default:
						done({ response: $response });
						break;
					case "Quantumult X":
						if (!$response.status) $response.status = "HTTP/1.1 200 OK";
						delete $response.headers?.["Content-Length"];
						delete $response.headers?.["content-length"];
						delete $response.headers?.["Transfer-Encoding"];
						done($response);
						break;
				}
				break;
			case "undefined": // 无构造回复数据，发送修改的请求数据
				//Console.debug("finally", `$request: ${JSON.stringify($request, null, 2)}`);
				done($request);
				break;
			default:
				Console.error(`不合法的 $response 类型: ${typeof $response}`);
				done();
				break;
		}
	});
