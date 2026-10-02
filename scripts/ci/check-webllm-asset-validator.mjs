#!/usr/bin/env node

function normalizeBaseUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

function normalizeUrl(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return new URL(trimmed).toString();
  } catch {
    return null;
  }
}

const DOWNLOAD_ONLY_CORS_SNIPPET = JSON.stringify(
  {
    AllowedOrigins: ["https://gomdory.com", "https://www.gomdory.com", "https://gkrry.com", "http://localhost:3000"],
    AllowedMethods: ["GET", "HEAD"],
    AllowedHeaders: ["Range", "Content-Type", "If-None-Match", "If-Modified-Since", "Accept"],
    ExposeHeaders: ["ETag", "Accept-Ranges", "Content-Range", "Content-Length", "Content-Type"],
    MaxAgeSeconds: 86400,
  },
  null,
  2,
);

function failWithRecommendation(reason, url, failureCode = "UNKNOWN") {
  console.error(`[ci:webllm-validator] FAILED url=${url} failureCode=${failureCode} reason=${reason}`);
  console.error("[ci:webllm-validator] Recommended Cloudflare R2 CORS (download-only):");
  console.error(DOWNLOAD_ONLY_CORS_SNIPPET);
  process.exit(1);
}

async function probe(url, { method, headers } = {}) {
  try {
    const response = await fetch(url, {
      method: method ?? "GET",
      headers,
      cache: "no-store",
    });
    return response;
  } catch {
    return null;
  }
}

async function directChecks() {
  const modelId = process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID?.trim();
  const modelBase = process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE?.replace(/\/+$/, "");
  const modelSubdir = (process.env.NEXT_PUBLIC_EDU_WEBLLM_MODEL_SUBDIR?.trim() || "resolve/main").replace(/^\/+|\/+$/g, "");
  const explicitWasmUrl = normalizeUrl(process.env.NEXT_PUBLIC_EDU_WEBLLM_WASM_URL);
  const wasmFilenamePrimary = process.env.NEXT_PUBLIC_EDU_WEBLLM_WASM_FILENAME_PRIMARY?.trim();
  const libBase = (process.env.NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE || `${modelBase}/libs`).replace(/\/+$/, "");
  const wasmUrl = explicitWasmUrl || (wasmFilenamePrimary ? new URL(wasmFilenamePrimary, `${libBase}/`).toString() : null);

  if (!modelId || !modelBase) {
    console.warn("[ci:webllm-validator] Skipping direct checks. Missing NEXT_PUBLIC_EDU_WEBLLM_MODEL_ID or NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE.");
    process.exit(0);
  }

  const configUrl = `${modelBase}/${modelId}/${modelSubdir}/mlc-chat-config.json`;
  const resolvedWasmUrl = wasmUrl || `${libBase}/${modelId}/${modelId}.wasm`;

  const configHead = await probe(configUrl, { method: "HEAD" });
  if (!configHead || configHead.status !== 200) {
    const failureCode = configHead?.status === 404 ? "NOT_FOUND" : configHead?.status === 403 ? "FORBIDDEN" : "UNKNOWN";
    failWithRecommendation("config HEAD must return 200", configUrl, failureCode);
  }

  const wasmHead = await probe(resolvedWasmUrl, { method: "HEAD" });
  if (!wasmHead || wasmHead.status !== 200) {
    const failureCode = wasmHead?.status === 404 ? "NOT_FOUND" : wasmHead?.status === 403 ? "FORBIDDEN" : "UNKNOWN";
    failWithRecommendation("wasm HEAD must return 200", resolvedWasmUrl, failureCode);
  }

  const wasmRange = await probe(resolvedWasmUrl, { method: "GET", headers: { Range: "bytes=0-1023" } });
  if (!wasmRange || ![200, 206].includes(wasmRange.status)) {
    failWithRecommendation("wasm Range GET must return 206 (or 200 for small files)", resolvedWasmUrl, "RANGE_UNSUPPORTED");
  }
  const allowOrigin = wasmRange.headers.get("access-control-allow-origin");
  if (!allowOrigin) {
    failWithRecommendation("missing access-control-allow-origin", resolvedWasmUrl, "CORS_BLOCKED");
  }
  const acceptRanges = (wasmRange.headers.get("accept-ranges") || wasmHead.headers.get("accept-ranges") || "").toLowerCase();
  if (acceptRanges !== "bytes") {
    failWithRecommendation("missing accept-ranges=bytes", resolvedWasmUrl, "RANGE_UNSUPPORTED");
  }

  console.log(`[ci:webllm-validator] PASS direct checks model=${modelId}`);
}

const baseUrl =
  normalizeBaseUrl(process.env.POST_DEPLOY_BASE_URL) ||
  normalizeBaseUrl(process.env.POST_DEPLOY_URL) ||
  normalizeBaseUrl(process.env.DEPLOY_URL) ||
  normalizeBaseUrl(process.env.CF_PAGES_URL) ||
  normalizeBaseUrl(process.env.URL);

if (!baseUrl) {
  await directChecks();
  process.exit(0);
}

const sampleJt = (process.env.POST_DEPLOY_WEBLLM_JT || process.env.SMOKE_WEBLLM_JT || "").trim();
const path = sampleJt
  ? `/api/v1/edu/webllm/asset-validator?entry=${encodeURIComponent(`/edu/lesson/1?jt=${sampleJt}`)}`
  : "/api/v1/edu/webllm/asset-validator";
const url = new URL(path, baseUrl).toString();
const response = await probe(url, { method: "GET", headers: { "x-smoke-test": "ci-webllm-asset-validator" } });

if (!response) {
  await directChecks();
  process.exit(0);
}

let payload = null;
try {
  payload = await response.json();
} catch {
  payload = null;
}

if (response.status === 403 && payload?.code === "WEBLLM_DOWNLOAD_BLOCKED") {
  console.log(`[ci:webllm-validator] PASS blocked-by-rule code=${payload.code} requestId=${payload.requestId ?? "-"}`);
  process.exit(0);
}

if (!response.ok || !payload?.ok) {
  const sections = [payload?.primary, payload?.fallback, payload?.coach].filter(Boolean);
  const failed = sections.find((entry) => entry?.ok === false);
  const rootCause = failed?.rootCause;
  failWithRecommendation(
    rootCause?.message || failed?.configHead?.message || failed?.wasmRange?.message || "validator returned non-ok",
    rootCause?.url || failed?.configHead?.url || url,
    rootCause?.failureCode || "UNKNOWN",
  );
}

console.log(
  `[ci:webllm-validator] PASS primary=${payload?.primary?.modelId ?? "-"} fallback=${payload?.fallback?.modelId ?? "-"} coach=${payload?.coach?.modelId ?? "-"}`,
);
