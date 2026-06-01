import gRPC from "@nsnanocat/grpc";
import { Console, done, fetch } from "@nsnanocat/util";
import { URL } from "@nsnanocat/url";
import { MessageType } from "@protobuf-ts/runtime/build/es2015/index.js";
import database from "./function/database.mjs";
import setENV from "./function/setENV.mjs";

const url = new URL($request.url);
const FORMAT = ($response.headers?.["Content-Type"] ?? $response.headers?.["content-type"])?.split(";")?.[0];
const PATHs = url.pathname.split("/").filter(Boolean);
const DEFAULT_CNHK_POOL = ["cn-hk-eq-01-03.bilivideo.com", "cn-hk-eq-01-13.bilivideo.com", "cn-hk-eq-01-12.bilivideo.com", "cn-hk-eq-01-01.bilivideo.com"];
const TVOS_CNHK_PROBE_CACHE_KEY = "@BiliBili.Redirect.Caches.tvOS.CNHKProbe";
const TVOS_CNHK_PROBE_TIMEOUT = 1800;
let cnhkProbePromise = null;

function isObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

function toArray(value) {
	if (Array.isArray(value)) return value;
	if (typeof value === "string") return [value];
	return [];
}

function getURLHost(value) {
	try {
		return new URL(value).hostname;
	} catch {
		return "";
	}
}

function rewriteRawURLAuthority(rawURL, protocol, host) {
	return rawURL.replace(/^[a-z][a-z\d+.-]*:\/\/[^/?#]+/iu, `${protocol}//${host}`);
}

function rawURLPathname(rawURL) {
	const match = rawURL.match(/^[a-z][a-z\d+.-]*:\/\/[^/?#]+([^?#]*)/iu);
	return match?.[1] ?? "";
}

function isCNHKHost(host) {
	return /^cn-hk-eq-\d{2}-\d{2}\.bilivideo\.com$/u.test(host);
}

function unique(values) {
	return [...new Set(values.filter(Boolean))];
}

function parseHostList(value) {
	return String(value ?? "")
		.split(",")
		.map(host => host.trim())
		.filter(isCNHKHost);
}

function getFallbackCNHKHost(Settings) {
	const configuredHost = Settings.Host?.AkamaiCNHK;
	return isCNHKHost(configuredHost) ? configuredHost : DEFAULT_CNHK_POOL[0];
}

function getCNHKPool(Settings) {
	const configuredPool = parseHostList(Settings.Host?.AkamaiCNHKPool);
	return unique(configuredPool.length ? configuredPool : DEFAULT_CNHK_POOL);
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

function writeCNHKProbeCache(rawURL, hosts) {
	try {
		const pathname = rawURLPathname(rawURL);
		const currentValue = readPersistentValue(TVOS_CNHK_PROBE_CACHE_KEY);
		const currentCache = currentValue ? JSON.parse(currentValue) : {};
		const entries = Array.isArray(currentCache.entries) ? currentCache.entries : [];
		const nextEntries = [
			{ pathname, hosts },
			...entries.filter(entry => entry?.pathname !== pathname),
		].slice(0, 20);
		writePersistentValue(TVOS_CNHK_PROBE_CACHE_KEY, JSON.stringify({ updatedAt: Date.now(), pathname, hosts, entries: nextEntries }));
	} catch (e) {
		Console.warn(`写入 CNHK 节点缓存失败: ${e}`);
	}
}

function getPreferredCNHKURL(values, Settings) {
	const configuredHost = Settings.Host?.AkamaiCNHK || "cn-hk-eq-01-03.bilivideo.com";
	const urls = values.filter(value => typeof value === "string" && /^https?:\/\//u.test(value));
	return urls.find(value => getURLHost(value) === configuredHost) ?? urls.find(value => /^cn-hk-eq-\d{2}-\d{2}\.bilivideo\.com$/u.test(getURLHost(value))) ?? "";
}

function isOverseaVideoHost(host) {
	return [
		"upos-sz-mirrorawsov.bilivideo.com",
		"upos-sz-mirroraliov.bilivideo.com",
		"upos-sz-mirrorcosov.bilivideo.com",
		"upos-sz-mirrorhwov.bilivideo.com",
	].includes(host);
}

function isSignedOverseaVideoURL(value) {
	return isOverseaVideoHost(getURLHost(value));
}

function isSignedAkamaiURL(value) {
	if (getURLHost(value) !== "upos-hz-mirrorakam.akamaized.net") return false;
	try {
		const candidate = new URL(value);
		return candidate.searchParams.get("os") === "akam" && /[?&]hdnts=exp(?:=|%3D)\d+~hmac(?:=|%3D)/u.test(value);
	} catch {
		return false;
	}
}

function shouldUseSignedAkamaiFallback(Settings) {
	return true;
}

function buildCNHKURL(rawURL, host) {
	return rewriteRawURLAuthority(rawURL, "http:", host);
}

function timeoutAfter(ms) {
	return new Promise(resolve => {
		setTimeout(() => resolve({ timeout: true }), ms);
	});
}

async function probeCNHKHost(rawURL, host, index, Settings) {
	const startedAt = Date.now();
	try {
		const response = await Promise.race([
			fetch(buildCNHKURL(rawURL, host), {
				method: "GET",
				headers: {
					Accept: "application/octet-stream",
					Range: "bytes=0-65535",
					"User-Agent": Settings.TVOS?.UserAgent || "Bilibili Freedoooooom/MarkII",
					Referer: "https://www.bilibili.com",
				},
				redirection: false,
				timeout: 2,
			}),
			timeoutAfter(TVOS_CNHK_PROBE_TIMEOUT),
		]);
		const status = response?.status ?? response?.statusCode;
		if (status !== 206) return null;
		return { host, index, duration: Date.now() - startedAt };
	} catch (e) {
		Console.debug(`CNHK probe failed: ${host} ${e}`);
		return null;
	}
}

async function getRankedCNHKHosts(rawURL, Settings) {
	if (!cnhkProbePromise) {
		cnhkProbePromise = (async () => {
			const pool = getCNHKPool(Settings);
			const probes = await Promise.all(pool.map((host, index) => probeCNHKHost(rawURL, host, index, Settings)));
			const ranked = probes
				.filter(Boolean)
				.sort((a, b) => (Math.abs(a.duration - b.duration) <= 50 ? a.index - b.index : a.duration - b.duration))
				.map(result => result.host);
			if (ranked.length) {
				Console.info(`Fastest CNHK hosts: ${ranked.join(", ")}`);
				return ranked;
			}
			const fallbackHost = getFallbackCNHKHost(Settings);
			return unique([fallbackHost, ...pool]);
		})();
	}
	return cnhkProbePromise;
}

function buildCNHKPlaybackPlan(rawURL, rankedHosts) {
	const hkURLs = unique(rankedHosts.map(host => buildCNHKURL(rawURL, host)));
	if (!hkURLs.length) return null;
	writeCNHKProbeCache(rawURL, rankedHosts);
	return {
		primary: hkURLs[0],
		backups: unique([...hkURLs.slice(1), rawURL]),
	};
}

function getFallbackPlaybackPlan(currentURL, backupCandidates, Settings) {
	const urls = [currentURL, ...backupCandidates].filter(value => typeof value === "string" && /^https?:\/\//u.test(value));
	const preferredCNHKURL = getPreferredCNHKURL(urls, Settings);
	if (preferredCNHKURL) return { primary: preferredCNHKURL, backups: reorderPreferredURL(backupCandidates, preferredCNHKURL) };
	const preferredOverseaURL = urls.find(isSignedOverseaVideoURL);
	if (preferredOverseaURL) return { primary: preferredOverseaURL, backups: reorderPreferredURL(backupCandidates, preferredOverseaURL) };
	if (!isOverseaVideoHost(getURLHost(currentURL))) return "";
	return "";
}

async function getPreferredPlaybackPlan(currentURL, backupCandidates, Settings) {
	const urls = [currentURL, ...backupCandidates].filter(value => typeof value === "string" && /^https?:\/\//u.test(value));
	if (shouldUseSignedAkamaiFallback(Settings)) {
		const signedAkamaiURL = urls.find(isSignedAkamaiURL);
		if (signedAkamaiURL) return buildCNHKPlaybackPlan(signedAkamaiURL, await getRankedCNHKHosts(signedAkamaiURL, Settings));
	}
	return getFallbackPlaybackPlan(currentURL, backupCandidates, Settings);
}

function reorderPreferredURL(values, preferredURL) {
	const urls = toArray(values);
	if (!preferredURL) return urls;
	return [preferredURL, ...urls.filter(value => value !== preferredURL)];
}

function arraysEqual(left = [], right = []) {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

async function rewriteJSONNode(node, Settings) {
	let rewriteCount = 0;
	if (Array.isArray(node)) {
		for (const item of node) rewriteCount += await rewriteJSONNode(item, Settings);
		return rewriteCount;
	}
	if (!isObject(node)) return rewriteCount;

	const backupCandidates = [
		...toArray(node.backup_url),
		...toArray(node.backupUrl),
		...toArray(node.backup_urls),
		...toArray(node.backupUrls),
	];
	const currentURL = ["base_url", "baseUrl", "url"].map(key => node[key]).find(value => typeof value === "string");
	const playbackPlan = await getPreferredPlaybackPlan(currentURL, backupCandidates, Settings);
	if (playbackPlan?.primary) {
		for (const key of ["base_url", "baseUrl", "url"]) {
			if (typeof node[key] === "string" && node[key] !== playbackPlan.primary) {
				node[key] = playbackPlan.primary;
				rewriteCount += 1;
			}
		}
		for (const key of ["backup_url", "backupUrl", "backup_urls", "backupUrls"]) {
			if (Array.isArray(node[key]) && !arraysEqual(node[key], playbackPlan.backups)) {
				node[key] = playbackPlan.backups;
				rewriteCount += 1;
			}
		}
	}

	for (const value of Object.values(node)) rewriteCount += await rewriteJSONNode(value, Settings);
	return rewriteCount;
}

class Stream$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.Stream", [
			{ no: 1, name: "stream_info", kind: "message", T: () => StreamInfo },
			{ no: 2, name: "dash_video", kind: "message", oneof: "content", T: () => DashVideo },
			{ no: 3, name: "segment_video", kind: "message", oneof: "content", T: () => SegmentVideo },
		]);
	}
}
const Stream = new Stream$Type();

class StreamInfo$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.StreamInfo", [
			{ no: 1, name: "quality", kind: "scalar", T: 13 },
			{ no: 2, name: "format", kind: "scalar", T: 9 },
			{ no: 3, name: "description", kind: "scalar", T: 9 },
			{ no: 4, name: "err_code", kind: "scalar", T: 13 },
			{ no: 6, name: "need_vip", kind: "scalar", T: 8 },
			{ no: 7, name: "need_login", kind: "scalar", T: 8 },
			{ no: 8, name: "intact", kind: "scalar", T: 8 },
			{ no: 9, name: "no_rexcode", kind: "scalar", T: 8 },
			{ no: 10, name: "attribute", kind: "scalar", T: 3, L: 2 },
			{ no: 11, name: "new_description", kind: "scalar", T: 9 },
			{ no: 12, name: "display_desc", kind: "scalar", T: 9 },
			{ no: 13, name: "superscript", kind: "scalar", T: 9 },
			{ no: 14, name: "vip_free", kind: "scalar", T: 8 },
			{ no: 15, name: "subtitle", kind: "scalar", T: 9 },
			{ no: 17, name: "support_drm", kind: "scalar", T: 8 },
		]);
	}
}
const StreamInfo = new StreamInfo$Type();

class DashVideo$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.DashVideo", [
			{ no: 1, name: "base_url", kind: "scalar", T: 9 },
			{ no: 2, name: "backup_url", kind: "scalar", repeat: 2, T: 9 },
			{ no: 3, name: "bandwidth", kind: "scalar", T: 13 },
			{ no: 4, name: "codecid", kind: "scalar", T: 13 },
			{ no: 5, name: "md5", kind: "scalar", T: 9 },
			{ no: 6, name: "size", kind: "scalar", T: 4, L: 2 },
			{ no: 7, name: "audio_id", kind: "scalar", T: 13 },
			{ no: 8, name: "no_rexcode", kind: "scalar", T: 8 },
			{ no: 9, name: "frame_rate", kind: "scalar", T: 9 },
			{ no: 10, name: "width", kind: "scalar", T: 5 },
			{ no: 11, name: "height", kind: "scalar", T: 5 },
			{ no: 12, name: "widevine_pssh", kind: "scalar", T: 9 },
		]);
	}
}
const DashVideo = new DashVideo$Type();

class ResponseUrl$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.ResponseUrl", [
			{ no: 1, name: "order", kind: "scalar", T: 13 },
			{ no: 2, name: "length", kind: "scalar", T: 4, L: 2 },
			{ no: 3, name: "size", kind: "scalar", T: 4, L: 2 },
			{ no: 4, name: "url", kind: "scalar", T: 9 },
			{ no: 5, name: "backup_url", kind: "scalar", repeat: 2, T: 9 },
			{ no: 6, name: "md5", kind: "scalar", T: 9 },
		]);
	}
}
const ResponseUrl = new ResponseUrl$Type();

class SegmentVideo$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.SegmentVideo", [{ no: 1, name: "segment", kind: "message", repeat: 1, T: () => ResponseUrl }]);
	}
}
const SegmentVideo = new SegmentVideo$Type();

class VodInfo$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.VodInfo", [
			{ no: 1, name: "quality", kind: "scalar", T: 13 },
			{ no: 2, name: "format", kind: "scalar", T: 9 },
			{ no: 3, name: "timelength", kind: "scalar", T: 4, L: 2 },
			{ no: 4, name: "video_codecid", kind: "scalar", T: 13 },
			{ no: 5, name: "stream_list", kind: "message", repeat: 1, T: () => Stream },
		]);
	}
}
const VodInfo = new VodInfo$Type();

class FragmentVideoInfo$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.FragmentVideoInfo", [
			{ no: 2, name: "vod_info", kind: "message", T: () => VodInfo },
			{ no: 5, name: "timelength", kind: "scalar", T: 3, L: 2 },
			{ no: 7, name: "playable_status", kind: "scalar", T: 8 },
		]);
	}
}
const FragmentVideoInfo = new FragmentVideoInfo$Type();

class FragmentVideo$Type extends MessageType {
	constructor() {
		super("bilibili.playershared.FragmentVideo", [{ no: 1, name: "videos", kind: "message", repeat: 1, T: () => FragmentVideoInfo }]);
	}
}
const FragmentVideo = new FragmentVideo$Type();

class PlayViewUniteReply$Type extends MessageType {
	constructor() {
		super("bilibili.app.playerunite.v1.PlayViewUniteReply", [
			{ no: 1, name: "vod_info", kind: "message", T: () => VodInfo },
			{ no: 10, name: "fragment_video", kind: "message", T: () => FragmentVideo },
		]);
	}
}
const PlayViewUniteReply = new PlayViewUniteReply$Type();

async function rewriteStreamList(streamList = [], Settings) {
	let rewriteCount = 0;
	for (const stream of streamList) {
		switch (stream?.content?.oneofKind) {
			case "dashVideo": {
				const video = stream.content.dashVideo;
				const playbackPlan = await getPreferredPlaybackPlan(video.baseUrl, video.backupUrl ?? [], Settings);
				if (playbackPlan?.primary && (video.baseUrl !== playbackPlan.primary || !arraysEqual(video.backupUrl ?? [], playbackPlan.backups))) {
					video.baseUrl = playbackPlan.primary;
					video.backupUrl = playbackPlan.backups;
					rewriteCount += 1;
				}
				break;
			}
			case "segmentVideo":
			case "SegmentVideo":
				for (const segment of stream.content.segmentVideo?.segment ?? []) {
					const playbackPlan = await getPreferredPlaybackPlan(segment.url, segment.backupUrl ?? [], Settings);
					if (playbackPlan?.primary && (segment.url !== playbackPlan.primary || !arraysEqual(segment.backupUrl ?? [], playbackPlan.backups))) {
						segment.url = playbackPlan.primary;
						segment.backupUrl = playbackPlan.backups;
						rewriteCount += 1;
					}
				}
				break;
		}
	}
	return rewriteCount;
}

async function rewriteVodInfo(vodInfo, Settings) {
	if (!vodInfo) return 0;
	return rewriteStreamList(vodInfo.streamList ?? [], Settings);
}

async function rewritePlayViewUnite(binaryBody, Settings) {
	const data = PlayViewUniteReply.fromBinary(binaryBody);
	let rewriteCount = await rewriteVodInfo(data.vodInfo, Settings);
	for (const video of data.fragmentVideo?.videos ?? []) rewriteCount += await rewriteVodInfo(video.vodInfo, Settings);
	if (rewriteCount > 0) {
		Console.info(`Signed playurl rewrites: ${rewriteCount}`);
		return PlayViewUniteReply.toBinary(data);
	}
	return binaryBody;
}

function deleteHeader(headers, name) {
	const key = Object.keys(headers ?? {}).find(item => item.toLowerCase() === name.toLowerCase());
	if (key) delete headers[key];
}

function normalizeChangedBodyHeaders() {
	if (!$response.headers) $response.headers = {};
	deleteHeader($response.headers, "Content-Length");
	deleteHeader($response.headers, "content-length");
}

(async () => {
	const { Settings } = setENV("BiliBili", "Redirect", database);
	Console.logLevel = Settings.LogLevel;
	switch (FORMAT) {
		case "application/json":
		case "text/json": {
			const body = JSON.parse($response.body ?? "{}");
			const rewriteCount = await rewriteJSONNode(body, Settings);
			if (rewriteCount > 0) {
				Console.info(`Signed JSON playurl rewrites: ${rewriteCount}`);
				$response.body = JSON.stringify(body);
				normalizeChangedBodyHeaders();
			}
			break;
		}
		case "application/grpc":
		case "application/grpc+proto": {
			switch (`${url.hostname}/${PATHs.join("/")}`) {
				case "grpc.biliapi.net/bilibili.app.playerunite.v1.Player/PlayViewUnite":
				case "app.biliapi.net/bilibili.app.playerunite.v1.Player/PlayViewUnite":
				case "app.bilibili.com/bilibili.app.playerunite.v1.Player/PlayViewUnite": {
					const rawBody = $response.body ?? new Uint8Array();
					const binaryBody = gRPC.decode(rawBody);
					const rewrittenBody = await rewritePlayViewUnite(binaryBody, Settings);
					if (rewrittenBody !== binaryBody) {
						$response.body = gRPC.encode(rewrittenBody);
						normalizeChangedBodyHeaders();
					}
					break;
				}
			}
			break;
		}
	}
})()
	.catch(e => Console.error(e))
	.finally(() => done($response));
