import gRPC from "@nsnanocat/grpc";
import { Console, done } from "@nsnanocat/util";
import { URL } from "@nsnanocat/url";
import { MessageType } from "@protobuf-ts/runtime/build/es2015/index.js";
import database from "./function/database.mjs";
import setENV from "./function/setENV.mjs";

const url = new URL($request.url);
const FORMAT = ($response.headers?.["Content-Type"] ?? $response.headers?.["content-type"])?.split(";")?.[0];
const PATHs = url.pathname.split("/").filter(Boolean);

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
	return (Settings.TVOS?.RedirectMode || "response-only") === "response-only";
}

function getPreferredPlaybackURL(currentURL, backupCandidates, Settings) {
	const urls = [currentURL, ...backupCandidates].filter(value => typeof value === "string" && /^https?:\/\//u.test(value));
	const preferredCNHKURL = getPreferredCNHKURL(urls, Settings);
	if (preferredCNHKURL) return preferredCNHKURL;
	if (!shouldUseSignedAkamaiFallback(Settings)) return "";
	const preferredAkamaiURL = urls.find(isSignedAkamaiURL);
	if (preferredAkamaiURL) return preferredAkamaiURL;
	const preferredOverseaURL = urls.find(isSignedOverseaVideoURL);
	if (preferredOverseaURL) return preferredOverseaURL;
	if (!isOverseaVideoHost(getURLHost(currentURL))) return "";
	return "";
}

function reorderPreferredURL(values, preferredURL) {
	const urls = toArray(values);
	if (!preferredURL) return urls;
	return [preferredURL, ...urls.filter(value => value !== preferredURL)];
}

function rewriteJSONNode(node, Settings) {
	let rewriteCount = 0;
	if (Array.isArray(node)) {
		for (const item of node) rewriteCount += rewriteJSONNode(item, Settings);
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
	const preferredURL = getPreferredPlaybackURL(currentURL, backupCandidates, Settings);
	if (preferredURL) {
		for (const key of ["base_url", "baseUrl", "url"]) {
			if (typeof node[key] === "string" && node[key] !== preferredURL) {
				node[key] = preferredURL;
				rewriteCount += 1;
			}
		}
		for (const key of ["backup_url", "backupUrl", "backup_urls", "backupUrls"]) {
			if (Array.isArray(node[key])) node[key] = reorderPreferredURL(node[key], preferredURL);
		}
	}

	for (const value of Object.values(node)) rewriteCount += rewriteJSONNode(value, Settings);
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

function rewriteStreamList(streamList = [], Settings) {
	let rewriteCount = 0;
	for (const stream of streamList) {
		switch (stream?.content?.oneofKind) {
			case "dashVideo": {
				const video = stream.content.dashVideo;
				const preferredURL = getPreferredPlaybackURL(video.baseUrl, video.backupUrl ?? [], Settings);
				if (preferredURL && video.baseUrl !== preferredURL) {
					video.baseUrl = preferredURL;
					video.backupUrl = reorderPreferredURL(video.backupUrl, preferredURL);
					rewriteCount += 1;
				}
				break;
			}
			case "segmentVideo":
			case "SegmentVideo":
				for (const segment of stream.content.segmentVideo?.segment ?? []) {
					const preferredURL = getPreferredPlaybackURL(segment.url, segment.backupUrl ?? [], Settings);
					if (preferredURL && segment.url !== preferredURL) {
						segment.url = preferredURL;
						segment.backupUrl = reorderPreferredURL(segment.backupUrl, preferredURL);
						rewriteCount += 1;
					}
				}
				break;
		}
	}
	return rewriteCount;
}

function rewriteVodInfo(vodInfo, Settings) {
	if (!vodInfo) return 0;
	return rewriteStreamList(vodInfo.streamList ?? [], Settings);
}

function rewritePlayViewUnite(binaryBody, Settings) {
	const data = PlayViewUniteReply.fromBinary(binaryBody);
	let rewriteCount = rewriteVodInfo(data.vodInfo, Settings);
	for (const video of data.fragmentVideo?.videos ?? []) rewriteCount += rewriteVodInfo(video.vodInfo, Settings);
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
			const rewriteCount = rewriteJSONNode(body, Settings);
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
					const rewrittenBody = rewritePlayViewUnite(binaryBody, Settings);
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
