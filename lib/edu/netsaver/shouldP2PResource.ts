import { readWebllmEnv } from "../llm/webllmConfig";
import { getP2PMaxBytes, type NetworkSaverTier } from "./config";

const MIN_BYTES = 0;

const TOKENIZER_PATTERN = /\/resolve\/main\/.+\/tokenizer\.[^/]+$/i;
const CONFIG_PATTERN = /\/resolve\/main\/.+\/(mlc-chat-config|config)\.json$/i;
const BPE_PATTERN = /\/resolve\/main\/.+\/(vocab\.json|merges\.txt)$/i;

const SMALL_SHARD_PATTERN = /\/resolve\/main\/.+\/(params_shard_\d+\.bin|weights_shard_\d+\.bin|shard_\d+\.bin)$/i;
const SMALL_MODEL_SHARD_PATTERN = /\/resolve\/main\/.+\/(model_\d+\.bin|params_\d+\.bin)$/i;
const SHARD_EXCLUDE_PATTERN = /\/resolve\/main\/.+\/(weights|params).*(\d{3,}|gb|large)/i;
const SHARD_BLOCKED_EXTENSION = /\.(safetensors|pt|ckpt)(\?|$)/i;

const readHeaderValue = (headers: HeadersInit | undefined | null, name: string) => {
  if (!headers) return null;
  if (headers instanceof Headers) {
    return headers.get(name);
  }
  if (Array.isArray(headers)) {
    const entry = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
    return entry ? entry[1] : null;
  }
  const record = headers as Record<string, string>;
  const key = Object.keys(record).find((header) => header.toLowerCase() === name.toLowerCase());
  return key ? record[key] : null;
};

const resolveAllowedHosts = () => {
  const env = readWebllmEnv();
  const hosts = new Set<string>(["models.gomdory.com"]);
  if (env.modelBase) {
    try {
      hosts.add(new URL(env.modelBase).host);
    } catch {
      // ignore invalid base
    }
  }
  if (env.libBase) {
    try {
      hosts.add(new URL(env.libBase).host);
    } catch {
      // ignore invalid base
    }
  }
  return hosts;
};

const isModelBasePath = (pathname: string) =>
  pathname.includes("/resolve/main/") || pathname.includes("/libs/");

export const isP2PResourceCandidate = (url: string) => {
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return false;
  }
  const allowedHosts = resolveAllowedHosts();
  if (!allowedHosts.has(parsed.host)) return false;
  if (!isModelBasePath(parsed.pathname)) return false;
  return true;
};

const readContentLength = (headers: HeadersInit | undefined | null) => {
  const raw = readHeaderValue(headers, "content-length");
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const isMetaResourcePath = (pathname: string) =>
  TOKENIZER_PATTERN.test(pathname) ||
  CONFIG_PATTERN.test(pathname) ||
  BPE_PATTERN.test(pathname);

const isSmallShardCandidatePath = (pathname: string) =>
  SMALL_SHARD_PATTERN.test(pathname) || SMALL_MODEL_SHARD_PATTERN.test(pathname);

const isSmallShardExcludedPath = (pathname: string) =>
  SHARD_EXCLUDE_PATTERN.test(pathname) || SHARD_BLOCKED_EXTENSION.test(pathname);

export const shouldP2PResource = (
  url: string,
  reqHeaders: HeadersInit | undefined,
  resHeaders: HeadersInit | null | undefined,
  tier: NetworkSaverTier,
): { ok: boolean; reason?: string; kind?: "wasm" | "meta" | "small_shard" } => {
  if (readHeaderValue(reqHeaders, "range")) return { ok: false, reason: "range" };
  if (!isP2PResourceCandidate(url)) return { ok: false, reason: "not_model_base" };

  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return { ok: false, reason: "invalid_url" };
  }

  const pathname = parsed.pathname;
  const isMeta = isMetaResourcePath(pathname);
  const isSmallShard = isSmallShardCandidatePath(pathname);

  if (tier === "wasm") return { ok: false, reason: "tier_wasm" };
  const kind =
    tier === "meta"
      ? isMeta
        ? "meta"
        : undefined
      : isMeta
        ? "meta"
        : isSmallShard
          ? "small_shard"
          : undefined;

  if (tier === "meta" && !isMeta) {
    return { ok: false, reason: "not_meta" };
  }
  if (tier === "small_shards" && !kind) {
    return { ok: false, reason: "not_shard" };
  }
  if (kind === "small_shard" && isSmallShardExcludedPath(pathname)) {
    return { ok: false, reason: "blocked_pattern", kind };
  }

  const size = readContentLength(resHeaders);
  if (!size) return { ok: false, reason: "no_length", kind };
  const maxBytes = getP2PMaxBytes();
  if (size < MIN_BYTES || size > maxBytes) return { ok: false, reason: "too_big", kind };

  return kind ? { ok: true, kind } : { ok: false, reason: "not_meta" };
};

export const getP2PResourceKindForUrl = (
  url: string,
  tier: NetworkSaverTier,
): "meta" | "small_shard" | null => {
  if (!isP2PResourceCandidate(url)) return null;
  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return null;
  }
  const pathname = parsed.pathname;
  const isMeta = isMetaResourcePath(pathname);
  const isSmallShard = isSmallShardCandidatePath(pathname) && !isSmallShardExcludedPath(pathname);
  if (tier === "meta") return isMeta ? "meta" : null;
  if (tier === "small_shards") {
    if (isMeta) return "meta";
    if (isSmallShard) return "small_shard";
  }
  return null;
};

export const getP2PResourceLimits = () => ({ MIN_BYTES, MAX_BYTES: getP2PMaxBytes() });
