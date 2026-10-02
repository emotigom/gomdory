import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import schemaVersionContract from "../contracts/schemaVersion.cjs";
import {
  createRunContext,
  setId,
  assertCtx,
  summarizeCtx,
  logCtx,
  updateRequestIdFromHeaders,
} from "../_shared/run-context.mjs";

const { SCHEMA_VERSIONS } = schemaVersionContract;
const MAX_REDIRECTS = 5;
const DEFAULT_MAX_ASSETS = 5;
const DEFAULT_ASSET_TIMEOUT_MS = 8000;
const BUILD_ID_TIMEOUT_MS = 8000;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CONTRACT_HASH_BASELINE_PATH = path.resolve(SCRIPT_DIR, "../contracts/contract-hash-baseline.json");

const getBaseUrl = () =>
  process.env.SELFCHECK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_SHORT_SITE_URL;

const getBaseUrls = () => {
  const multi = process.env.SELFCHECK_BASE_URLS;
  if (multi) {
    return multi
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  const single = getBaseUrl();
  return single ? [single] : [];
};

const buildUrl = (base, routePath) => new URL(routePath, base).toString();

const argv = process.argv.slice(2);

const hasArg = (flag) => argv.includes(flag);
const readArgValue = (flag) => {
  const index = argv.indexOf(flag);
  if (index === -1) return null;
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) return null;
  return value;
};
const parseNumberArg = (flag, fallback) => {
  const raw = readArgValue(flag);
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : fallback;
};

const jsonSummary = hasArg("--json-summary");
const strictMode = hasArg("--strict") || !hasArg("--soft");
const softMode = hasArg("--soft");
const updateContractHashBaseline = hasArg("--update-contract-hash-baseline");
const failOnContractHashMismatch = hasArg("--fail-on-contract-hash-mismatch") || !softMode;

const logPageProbe = (stage, detail = {}) => {
  if (jsonSummary) return;
  const payload = { stage, ...detail };
  console.log(JSON.stringify(payload));
};

const ctxLogger = {
  info: (payload) => {
    console.log(JSON.stringify(payload));
  },
};

const readEnv = (name) => {
  const value = process.env[name];
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const resolveAuthBaseUrl = (baseUrls) =>
  readEnv("SELFCHECK_AUTH_BASE_URL") ||
  readEnv("NEXT_PUBLIC_SITE_URL") ||
  baseUrls.find((url) => url.includes("gomdory.com")) ||
  baseUrls[0] ||
  null;

const resolvePublicBaseUrl = (baseUrls) =>
  readEnv("SELFCHECK_PUBLIC_BASE_URL") ||
  readEnv("NEXT_PUBLIC_SHORT_SITE_URL") ||
  baseUrls.find((url) => url.includes("gkrry.com")) ||
  baseUrls[0] ||
  null;

const buildCookieHeader = (cookiesJar) => {
  if (!cookiesJar) return null;
  if (typeof cookiesJar === "string") return cookiesJar;
  if (cookiesJar instanceof Map) {
    return Array.from(cookiesJar.entries())
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
  if (typeof cookiesJar === "object") {
    return Object.entries(cookiesJar)
      .map(([key, value]) => `${key}=${value}`)
      .join("; ");
  }
  return null;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildFetchSource = (method, targetUrl) => {
  try {
    const url = new URL(targetUrl);
    const path = `${url.pathname}${url.search ?? ""}`;
    return `fetch:${method}:${path}`;
  } catch {
    return `fetch:${method}:unknown`;
  }
};

const fetchWithTimeout = async (
  url,
  { timeoutMs, headers, method = "GET", body, ctx, source } = {},
) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method, headers, body, signal: controller.signal });
    if (ctx) {
      updateRequestIdFromHeaders(ctx, response.headers, {
        source: source ?? buildFetchSource(method, url),
      });
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
};

const isRetriableFetchError = (error) => {
  if (!error) return false;
  if (error.name === "AbortError") return true;
  if (error instanceof TypeError) return true;
  const code = error.code || error.cause?.code;
  return Boolean(code);
};

const followRedirects = async (url) => {
  let currentUrl = url;
  let redirects = 0;
  let lastResponse = null;
  let lastLocation = null;

  for (let i = 0; i <= MAX_REDIRECTS; i += 1) {
    lastResponse = await fetch(currentUrl, {
      method: "GET",
      redirect: "manual",
      headers: {
        "user-agent": "gom-selfcheck-probe",
      },
    });

    const location = lastResponse.headers.get("location");
    if (lastResponse.status >= 300 && lastResponse.status < 400 && location) {
      redirects += 1;
      lastLocation = location;
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }
    break;
  }

  const finalUrl = lastResponse?.url || currentUrl;
  const finalHost = finalUrl ? new URL(finalUrl).host : null;
  const redirectLoop =
    redirects >= MAX_REDIRECTS && lastResponse?.status && lastResponse.status >= 300 && lastResponse.status < 400;

  return {
    url,
    status: lastResponse?.status ?? null,
    redirects,
    finalUrl,
    finalHost,
    location: lastLocation,
    redirectLoop,
  };
};

const hasAuthEnv = () =>
  Object.keys(process.env).some((key) => key.startsWith("E2E_") || key.startsWith("SMOKE_"));

const runAuthSmoke = () => {
  if (!hasAuthEnv()) {
    console.log("[selfcheck:probe] Auth smoke skipped (no E2E_/SMOKE_ env vars).");
    return { status: "skipped" };
  }
  console.log("[selfcheck:probe] Running auth smoke test...");
  const result = spawnSync("npm", ["run", "test:smoke:auth"], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("[selfcheck:probe] Auth smoke failed.");
    process.exit(result.status ?? 1);
  }
  return { status: "ok" };
};

const extractNextAssetsFromHtml = (html, maxAssets) => {
  if (!html) return [];
  const matches = html.match(/\/_next\/static\/[^"'<>\s]+/g) ?? [];
  const seen = new Set();
  const unique = [];
  for (const asset of matches) {
    if (seen.has(asset)) continue;
    seen.add(asset);
    unique.push(asset);
  }
  const priority = (asset) => {
    if (asset.endsWith(".css")) return 0;
    if (asset.endsWith(".js")) return 1;
    return 2;
  };
  unique.sort((a, b) => {
    const diff = priority(a) - priority(b);
    if (diff !== 0) return diff;
    return a.localeCompare(b);
  });
  return unique.slice(0, maxAssets);
};

const truncateBuildId = (buildId) => (buildId ? buildId.slice(0, 12) : null);

const createSummary = () => ({
  ok: true,
  failedCount: 0,
  skippedCount: 0,
  baseUrls: {
    auth: { baseUrl: null, buildIdOk: false, mismatch: false, buildId: null },
    public: { baseUrl: null, buildIdOk: false, mismatch: false, buildId: null },
  },
  failures: [],
  truncated: false,
  notes: [],
});

let lastProbeCtx = null;

const addSummaryNote = (summary, note) => {
  if (!summary || !note) return;
  if (!summary.notes.includes(note)) {
    summary.notes.push(note);
  }
};

const addSummaryFailure = (summary, failure) => {
  if (!summary || !failure) return;
  summary.failedCount += 1;
  summary.ok = false;
  if (summary.failures.length < 10) {
    summary.failures.push(failure);
  } else {
    summary.truncated = true;
    addSummaryNote(summary, "failures_truncated");
  }
};

const addContractMismatchFailure = (summary, endpointKey, expected, actual) => {
  if (!summary || !endpointKey) return;
  addSummaryFailure(summary, {
    endpointKey,
    expected: {
      schemaVersion: expected?.schemaVersion ?? null,
      contractHash: expected?.contractHash ?? null,
    },
    actual: {
      schemaVersion: actual?.schemaVersion ?? null,
      contractHash: actual?.contractHash ?? null,
    },
  });
};

const addSummarySkip = (summary, reason) => {
  if (!summary) return;
  summary.skippedCount += 1;
  addSummaryNote(summary, reason);
};

const getPageFailureKind = (result) => {
  if (!result) return "http_status";
  if (result.responseStatus !== 200) return "http_status";
  if (!result.isHtml) return "page_not_html";
  if (!result.missingMarker) return "page_marker_missing";
  if (result.missingMarker === "gom:layout") return "marker_missing_layout";
  if (result.missingMarker === "gom:page") return "marker_missing_page";
  if (result.missingMarker.startsWith("gom:panel")) return "marker_missing_panel";
  return "page_marker_missing";
};

const baseKeyForUrl = (baseUrl, authBaseUrl, publicBaseUrl) => {
  if (baseUrl && authBaseUrl && baseUrl === authBaseUrl) return "auth";
  if (baseUrl && publicBaseUrl && baseUrl === publicBaseUrl) return "public";
  return null;
};

const logApiProbe = (stage, detail = {}) => {
  if (jsonSummary) return;
  console.log(JSON.stringify({ stage, ...detail }));
};

const extractResponseData = (body) => {
  if (!body || typeof body !== "object") return null;
  if ("data" in body) return body.data;
  return body;
};

const readSchemaVersion = (body) => {
  const data = extractResponseData(body);
  return data && typeof data === "object" && "schemaVersion" in data ? data.schemaVersion : null;
};

const readContractMeta = (body) => {
  const data = extractResponseData(body);
  if (!data || typeof data !== "object") {
    return { schemaVersion: null, contractHash: null };
  }
  return {
    schemaVersion: "schemaVersion" in data ? data.schemaVersion : null,
    contractHash: "contractHash" in data ? data.contractHash : null,
  };
};

const readContractHashBaseline = () => {
  if (!fs.existsSync(CONTRACT_HASH_BASELINE_PATH)) return {};
  try {
    const raw = fs.readFileSync(CONTRACT_HASH_BASELINE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeContractHashBaseline = (baseline) => {
  const payload = JSON.stringify(baseline ?? {}, null, 2);
  fs.writeFileSync(CONTRACT_HASH_BASELINE_PATH, `${payload}\n`, "utf8");
};

const probeSchemaVersion = async ({
  baseUrl,
  path,
  expected,
  baseKey,
  summary,
  allowUnauthorized,
  ctx,
}) => {
  if (!baseUrl) {
    logApiProbe("api_schema_probe_skipped", { path, reason: "missing_base_url" });
    addSummarySkip(summary, "missing_base_url");
    return { status: "skipped" };
  }

  const url = buildUrl(baseUrl, path);
  logApiProbe("api_schema_probe_start", { path, url, expected });
  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: BUILD_ID_TIMEOUT_MS,
      headers: { "user-agent": "gom-selfcheck-probe" },
      ctx,
      source: buildFetchSource("GET", url),
    });
    const body = await response.json().catch(() => null);
    const actual = readSchemaVersion(body);
    if (allowUnauthorized && (response.status === 401 || response.status === 403)) {
      logApiProbe("api_schema_probe_skipped", { path, status: response.status, reason: "unauthorized" });
      addSummarySkip(summary, "schema_version_skipped_unauthorized");
      return { status: "skipped" };
    }
    if (response.status !== 200) {
      logApiProbe("api_schema_probe_failed", { path, status: response.status });
      addSummaryFailure(summary, {
        kind: "http_status",
        base: baseKey,
        path,
        status: response.status,
        expected,
        actual,
      });
      return { status: "fail" };
    }
    if (actual !== expected) {
      logApiProbe("api_schema_probe_failed", { path, expected, actual });
      addSummaryFailure(summary, {
        kind: "schema_version_mismatch",
        base: baseKey,
        path,
        status: response.status,
        expected,
        actual,
      });
      return { status: "fail" };
    }
    logApiProbe("api_schema_probe_ok", { path, status: response.status, expected, actual });
    return { status: "ok" };
  } catch (error) {
    logApiProbe("api_schema_probe_failed", { path, error: error instanceof Error ? error.message : String(error) });
    addSummaryFailure(summary, {
      kind: "fetch_error",
      base: baseKey,
      path,
      status: null,
      expected,
      actual: null,
    });
    return { status: "fail" };
  }
};

const probeContractHash = async ({
  baseUrl,
  path,
  endpointKey,
  expected,
  baseKey,
  summary,
  allowUnauthorized,
  requestInit,
  updateBaseline,
  baselineUpdates,
  failOnMismatch,
  ctx,
}) => {
  if (!baseUrl) {
    logApiProbe("api_contract_probe_skipped", { endpointKey, reason: "missing_base_url" });
    addSummarySkip(summary, "missing_base_url");
    return { status: "skipped" };
  }

  const url = buildUrl(baseUrl, path);
  logApiProbe("api_contract_probe_start", { endpointKey, url });
  try {
    const response = await fetchWithTimeout(url, {
      timeoutMs: BUILD_ID_TIMEOUT_MS,
      headers: { "user-agent": "gom-selfcheck-probe", ...(requestInit?.headers ?? {}) },
      method: requestInit?.method ?? "GET",
      body: requestInit?.body,
      ctx,
      source: buildFetchSource(requestInit?.method ?? "GET", url),
    });
    const body = await response.json().catch(() => null);
    const actual = readContractMeta(body);
    if (allowUnauthorized && (response.status === 401 || response.status === 403)) {
      logApiProbe("api_contract_probe_skipped", {
        endpointKey,
        status: response.status,
        reason: "unauthorized",
      });
      addSummarySkip(summary, "contract_hash_skipped_unauthorized");
      return { status: "skipped" };
    }

    if (response.status !== 200) {
      logApiProbe("api_contract_probe_failed", { endpointKey, status: response.status });
      addSummaryFailure(summary, {
        endpointKey,
        expected,
        actual,
      });
      return { status: "fail" };
    }

    if (updateBaseline && baselineUpdates) {
      if (actual.schemaVersion !== null && actual.contractHash !== null) {
        baselineUpdates[endpointKey] = actual;
      } else {
        logApiProbe("api_contract_probe_skipped", {
          endpointKey,
          reason: "missing_contract_meta",
        });
      }
    }

    const expectedSchemaVersion = expected?.schemaVersion ?? null;
    const expectedContractHash = expected?.contractHash ?? null;

    if (expectedSchemaVersion !== actual.schemaVersion) {
      logApiProbe("api_contract_probe_failed", {
        endpointKey,
        expected: expectedSchemaVersion,
        actual: actual.schemaVersion,
      });
      if (failOnMismatch) {
        addContractMismatchFailure(summary, endpointKey, expected, actual);
      }
      return { status: failOnMismatch ? "fail" : "ok" };
    }

    if (expectedContractHash !== actual.contractHash) {
      logApiProbe("api_contract_probe_failed", {
        endpointKey,
        expected: expectedContractHash,
        actual: actual.contractHash,
      });
      if (failOnMismatch) {
        addContractMismatchFailure(summary, endpointKey, expected, actual);
      }
      return { status: failOnMismatch ? "fail" : "ok" };
    }

    logApiProbe("api_contract_probe_ok", {
      endpointKey,
      status: response.status,
      expected: expectedContractHash,
      actual: actual.contractHash,
    });
    return { status: "ok" };
  } catch (error) {
    logApiProbe("api_contract_probe_failed", {
      endpointKey,
      error: error instanceof Error ? error.message : String(error),
    });
    addSummaryFailure(summary, {
      kind: "fetch_error",
      base: baseKey,
      endpointKey,
      path,
      status: null,
      expected,
      actual: null,
    });
    return { status: "fail" };
  }
};

const probeBuildId = async (baseUrl, ctx) => {
  const headers = { "user-agent": "gom-selfcheck-probe" };
  const staticUrl = buildUrl(baseUrl, "/_next/static/BUILD_ID");
  const rootUrl = buildUrl(baseUrl, "/BUILD_ID");

  logPageProbe("build_id_check_start", { baseUrl });

  let statusStatic = null;
  let statusRoot = null;
  let buildIdStatic = null;
  let buildIdRoot = null;
  let errorCaught = null;

  try {
    const responseStatic = await fetchWithTimeout(staticUrl, {
      timeoutMs: BUILD_ID_TIMEOUT_MS,
      headers,
      ctx,
      source: buildFetchSource("GET", staticUrl),
    });
    statusStatic = responseStatic.status;
    if (responseStatic.status === 200) {
      buildIdStatic = (await responseStatic.text()).trim();
    }
  } catch (error) {
    errorCaught = error;
  }

  try {
    const responseRoot = await fetchWithTimeout(rootUrl, {
      timeoutMs: BUILD_ID_TIMEOUT_MS,
      headers,
      ctx,
      source: buildFetchSource("GET", rootUrl),
    });
    statusRoot = responseRoot.status;
    if (responseRoot.status === 200) {
      buildIdRoot = (await responseRoot.text()).trim();
    }
  } catch (error) {
    errorCaught = error;
  }

  const mismatch =
    statusStatic === 200 &&
    statusRoot === 200 &&
    buildIdStatic &&
    buildIdRoot &&
    buildIdStatic !== buildIdRoot;
  const ok = statusStatic === 200 && statusRoot === 200 && !mismatch;

  const detail = {
    baseUrl,
    statusStatic,
    statusRoot,
    buildIdStatic: truncateBuildId(buildIdStatic),
    buildIdRoot: truncateBuildId(buildIdRoot),
    mismatch: Boolean(mismatch),
  };

  if (ok) {
    logPageProbe("build_id_ok", detail);
    return {
      ok: true,
      buildId: buildIdStatic,
      mismatch: false,
      statusStatic,
      statusRoot,
    };
  }

  const summary =
    mismatch && statusStatic === 200 && statusRoot === 200
      ? "build_id_mismatch: 도메인 캐시/배포 불일치 가능"
      : "build_id_failed";
  const nextSteps =
    mismatch && statusStatic === 200 && statusRoot === 200
      ? ["Check Cloudflare Pages deployments for both domains", "Purge cache if needed"]
      : undefined;

  logPageProbe("build_id_failed", {
    ...detail,
    summary,
    nextSteps,
    error: errorCaught ? (errorCaught instanceof Error ? errorCaught.message : String(errorCaught)) : null,
  });
  return {
    ok: false,
    reason: mismatch ? "build_id_mismatch" : "build_id_failed",
    mismatch: Boolean(mismatch),
    statusStatic,
    statusRoot,
    buildId: buildIdStatic || buildIdRoot,
  };
};

const probeAssets = async ({ baseUrl, pagePath, assetPaths, timeoutMs, ctx }) => {
  const headers = { "user-agent": "gom-selfcheck-probe" };
  logPageProbe("assets_probe_start", {
    baseUrl,
    pagePath,
    assetCount: assetPaths.length,
  });

  if (!assetPaths.length) {
    logPageProbe("assets_probe_ok", {
      baseUrl,
      pagePath,
      assetCount: 0,
      checkedCount: 0,
    });
    return { ok: true };
  }

  let checkedCount = 0;

  for (const assetPath of assetPaths) {
    const assetUrl = buildUrl(baseUrl, assetPath);
    let response = null;
    let errorCaught = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        response = await fetchWithTimeout(assetUrl, {
          timeoutMs,
          headers,
          ctx,
          source: buildFetchSource("GET", assetUrl),
        });
        break;
      } catch (error) {
        errorCaught = error;
        if (attempt === 0 && isRetriableFetchError(error)) {
          await sleep(200);
          continue;
        }
        break;
      }
    }

    checkedCount += 1;

    if (!response) {
      logPageProbe("assets_probe_failed", {
        baseUrl,
        pagePath,
        assetCount: assetPaths.length,
        checkedCount,
        firstFailedAsset: assetPath,
        status: null,
        error: errorCaught ? (errorCaught instanceof Error ? errorCaught.message : String(errorCaught)) : null,
      });
      return { ok: false, assetPath };
    }

    if (response.status !== 200) {
      const summary = response.status >= 400 ? "_next/static asset missing" : undefined;
      const nextSteps =
        response.status >= 400
          ? ["Check build output & routing to _next/static", "Verify asset URLs not pointing to other host"]
          : undefined;
      logPageProbe("assets_probe_failed", {
        baseUrl,
        pagePath,
        assetCount: assetPaths.length,
        checkedCount,
        firstFailedAsset: assetPath,
        status: response.status,
        summary,
        nextSteps,
      });
      return { ok: false, assetPath, status: response.status };
    }
  }

  logPageProbe("assets_probe_ok", {
    baseUrl,
    pagePath,
    assetCount: assetPaths.length,
    checkedCount,
  });
  return { ok: true };
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasExpectedMetaMarker = (html, { name, value }) => {
  if (!html) return false;
  const escapedName = escapeRegExp(name);
  const tagPattern = new RegExp(`<meta\\s+[^>]*name=["']${escapedName}["'][^>]*>`, "gi");
  const matches = html.match(tagPattern) ?? [];
  if (matches.length === 0) return false;
  if (value === undefined) return true;
  for (const tag of matches) {
    const contentMatch = tag.match(/content=["']([^"']*)["']/i);
    if (!contentMatch) continue;
    if (contentMatch[1] === value) {
      return true;
    }
  }
  return false;
};

const findMissingMarker = (html, expectedMarkers) => {
  for (const marker of expectedMarkers) {
    if (!hasExpectedMetaMarker(html, marker)) {
      return marker.name;
    }
  }
  return null;
};

async function probeHtmlPage({ baseUrl, path, expectedMarkers, cookiesJar, ctx }) {
  const url = buildUrl(baseUrl, path);
  const markersExpected = expectedMarkers;
  const baseHeaders = {
    "user-agent": "gom-selfcheck-probe",
  };
  const cookieHeader = buildCookieHeader(cookiesJar);

  if (cookieHeader) {
    baseHeaders.cookie = cookieHeader;
  }

  logPageProbe("pages_probe_start", { url, markersExpected });

  let lastError = null;
  let responseStatus = null;
  let markerFound = false;
  let missingMarker = null;
  let requestId = null;
  let html = null;
  let isHtml = false;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { method: "GET", headers: baseHeaders });
      if (ctx) {
        updateRequestIdFromHeaders(ctx, response.headers, {
          source: buildFetchSource("GET", url),
        });
      }
      responseStatus = response.status;
      requestId =
        response.headers.get("x-request-id") ?? response.headers.get("x-gom-request-id") ?? null;
      const contentType = response.headers.get("content-type") ?? "";
      isHtml = contentType.includes("text/html");
      if (isHtml) {
        const bodyText = await response.text();
        html = bodyText;
        missingMarker = findMissingMarker(bodyText, markersExpected);
        markerFound = !missingMarker;
      } else {
        markerFound = false;
      }

      const ok = responseStatus === 200 && isHtml && markerFound;
      if (ok) {
        logPageProbe("pages_probe_ok", {
          url,
          responseStatus,
          markersExpected,
          markerFound,
          missingMarker,
          requestId,
        });
        return {
          ok: true,
          url,
          responseStatus,
          markerFound,
          markersExpected,
          missingMarker,
          requestId,
          html,
          path,
          isHtml,
        };
      }

      if (attempt === 0 && responseStatus >= 500) {
        continue;
      }

      logPageProbe("pages_probe_failed", {
        url,
        responseStatus,
        markersExpected,
        markerFound,
        missingMarker,
        requestId,
      });
      return {
        ok: false,
        url,
        responseStatus,
        markerFound,
        markersExpected,
        missingMarker,
        requestId,
        path,
        isHtml,
      };
    } catch (error) {
      lastError = error;
      if (attempt === 0) {
        continue;
      }
      logPageProbe("pages_probe_failed", {
        url,
        responseStatus,
        markersExpected,
        markerFound,
        missingMarker,
        requestId,
      });
      return {
        ok: false,
        url,
        responseStatus,
        markerFound,
        markersExpected,
        missingMarker,
        requestId,
        error,
        path,
        isHtml,
      };
    }
  }

  logPageProbe("pages_probe_failed", {
    url,
    responseStatus,
    markersExpected,
    markerFound,
    missingMarker,
    requestId,
  });

  return {
    ok: false,
    url,
    responseStatus,
    markerFound,
    markersExpected,
    missingMarker,
    requestId,
    error: lastError,
    path,
    isHtml,
  };
}

const run = async () => {
  const summary = jsonSummary ? createSummary() : null;
  const baseUrls = getBaseUrls();
  const authBaseUrl = resolveAuthBaseUrl(baseUrls);
  const publicBaseUrl = resolvePublicBaseUrl(baseUrls);
  const authCtx = createRunContext({ mode: "probe-auth", baseUrl: authBaseUrl });
  const publicCtx = createRunContext({ mode: "probe-public", baseUrl: publicBaseUrl });
  lastProbeCtx = { auth: authCtx, public: publicCtx };
  const attachSummaryCtx = () => {
    if (summary) {
      summary.ctx = {
        auth: summarizeCtx(authCtx),
        public: summarizeCtx(publicCtx),
      };
    }
  };
  if (!baseUrls.length) {
    const message =
      "Missing base URL. Set SELFCHECK_BASE_URLS, SELFCHECK_BASE_URL, or NEXT_PUBLIC_SITE_URL.";
    if (summary) {
      summary.ok = false;
      attachSummaryCtx();
      addSummaryNote(summary, "missing_base_url");
      addSummaryFailure(summary, {
        kind: "http_status",
        base: "public",
        path: null,
        asset: null,
        status: null,
        markerExpected: null,
      });
      console.log(JSON.stringify(summary));
      process.exit(1);
    } else {
      console.error(`[selfcheck:probe] ${message}`);
      process.exit(1);
    }
  }

  const routes = ["/__health", "/api/health", "/_next/static/BUILD_ID", "/auth/login"];

  const shareCode = process.env.SELFCHECK_SHARE_CODE;
  if (shareCode) {
    setId(publicCtx, "shareCode", shareCode, { source: "env" });
    routes.push(`/s/${shareCode}`);
    routes.push(`/s/${shareCode}/present`);
  }

  const summaryMode = hasArg("--summary");
  const pagesMode = hasArg("--pages");
  const assetsMode = hasArg("--assets") || pagesMode;
  const contractHashMode = hasArg("--contract-hash") || pagesMode || assetsMode;
  const maxAssets = Math.max(0, parseNumberArg("--max-assets", DEFAULT_MAX_ASSETS));
  const assetTimeoutMs = Math.max(1000, parseNumberArg("--asset-timeout-ms", DEFAULT_ASSET_TIMEOUT_MS));
  const summaryRoutes = new Set(["/__health", "/api/health", "/_next/static/BUILD_ID", "/auth/login"]);
  const contractHashBaseline =
    contractHashMode || updateContractHashBaseline ? readContractHashBaseline() : null;
  const contractHashUpdates = contractHashBaseline ? { ...contractHashBaseline } : {};

  if (!jsonSummary) {
    for (const baseUrl of baseUrls) {
      const baseHost = new URL(baseUrl).host;
      const results = [];
      for (const routePath of routes) {
        const url = buildUrl(baseUrl, routePath);
        try {
          const result = await followRedirects(url);
          results.push({ ...result, path: routePath, baseHost });
        } catch (error) {
          results.push({
            path: routePath,
            url,
            status: null,
            redirects: null,
            finalUrl: null,
            finalHost: null,
            location: null,
            error: error instanceof Error ? error.message : String(error),
            baseHost,
          });
        }
      }

      if (summaryMode) {
        console.log(`[selfcheck:probe] Summary (${baseUrl})`);
        for (const result of results.filter((item) => summaryRoutes.has(item.path))) {
          let summary = "ok";
          if (result.error) {
            summary = `error=${result.error}`;
          } else if (result.redirectLoop) {
            summary = `redirect loop (${result.redirects ?? "-"})`;
          } else if (result.finalHost && result.finalHost !== result.baseHost) {
            summary = `host mismatch (${result.finalHost})`;
          } else if (result.status && result.status >= 500) {
            summary = `5xx (${result.status})`;
          } else if (result.status && result.status >= 400) {
            summary = `4xx (${result.status})`;
          } else {
            summary = `ok (${result.status ?? "-"})`;
          }
          console.log(`- ${result.path}: ${summary}`);
        }
      } else {
        console.log(`[selfcheck:probe] Results (${baseUrl}):`);
        for (const result of results) {
          console.log(
            `${result.path} -> status=${result.status ?? "ERR"} redirects=${result.redirects ?? "-"} finalHost=${
              result.finalHost ?? "-"
            } location=${result.location ?? "-"}`
          );
        }
      }
    }
  }

  if (pagesMode) {
    const boardId = readEnv("SELFCHECK_BOARD_ID");
    const wallId = readEnv("SELFCHECK_WALL_ID");
    const fileId = readEnv("SELFCHECK_FILE_ID");
    if (boardId) {
      setId(authCtx, "boardId", boardId, { source: "env" });
    }
    if (wallId) {
      setId(authCtx, "wallId", wallId, { source: "env" });
    }
    if (fileId) {
      setId(authCtx, "fileId", fileId, { source: "env" });
    }
    const buildIdCache = new Map();
    if (summary) {
      summary.baseUrls.auth.baseUrl = authBaseUrl;
      summary.baseUrls.public.baseUrl = publicBaseUrl;
      attachSummaryCtx();
    }

    logCtx(ctxLogger, "probe", authCtx, { scope: "auth" });
    logCtx(ctxLogger, "probe", publicCtx, { scope: "public" });

    const ensureBuildId = async (baseUrl) => {
      if (!assetsMode || !baseUrl) return null;
      if (buildIdCache.has(baseUrl)) return buildIdCache.get(baseUrl);
      const baseKey = baseKeyForUrl(baseUrl, authBaseUrl, publicBaseUrl);
      const ctx = baseKey === "auth" ? authCtx : baseKey === "public" ? publicCtx : null;
      const result = await probeBuildId(baseUrl, ctx);
      buildIdCache.set(baseUrl, result);
      if (baseKey === "auth") {
        authCtx.meta.buildId = result.buildId ?? null;
      }
      if (baseKey === "public") {
        publicCtx.meta.buildId = result.buildId ?? null;
      }
      if (summary) {
        if (baseKey) {
          summary.baseUrls[baseKey].buildIdOk = result.ok;
          summary.baseUrls[baseKey].mismatch = Boolean(result.mismatch);
          summary.baseUrls[baseKey].buildId = truncateBuildId(result.buildId);
          if (!result.ok) {
            if (result.mismatch) {
              addSummaryFailure(summary, {
                kind: "build_id_mismatch",
                base: baseKey,
                path: "/_next/static/BUILD_ID",
                asset: null,
                status: 200,
                markerExpected: null,
              });
            } else if (result.statusStatic !== 200) {
              addSummaryFailure(summary, {
                kind: "http_status",
                base: baseKey,
                path: "/_next/static/BUILD_ID",
                asset: null,
                status: result.statusStatic ?? null,
                markerExpected: null,
              });
            } else if (result.statusRoot !== 200) {
              addSummaryFailure(summary, {
                kind: "http_status",
                base: baseKey,
                path: "/BUILD_ID",
                asset: null,
                status: result.statusRoot ?? null,
                markerExpected: null,
              });
            }
          }
        }
      }
      return result;
    };

    if (!authBaseUrl) {
      logPageProbe("pages_probe_skipped", { reason: "missing_auth_base_url" });
      addSummarySkip(summary, "missing_auth_base_url");
    } else if (!boardId || !wallId) {
      assertCtx(authCtx, ["boardId", "wallId"], { stage: "pages_probe", soft: true });
      logPageProbe("pages_probe_skipped", { reason: "missing_board_context" });
      addSummarySkip(summary, "missing_board_context");
    } else {
      if (assetsMode) {
        await ensureBuildId(authBaseUrl);
      }
      const dashboardResult = await probeHtmlPage({
        baseUrl: authBaseUrl,
        path: "/dashboard",
        ctx: authCtx,
        expectedMarkers: [
          { name: "gom:layout", value: "dashboard" },
          { name: "gom:page", value: "dashboard_root" },
          { name: "gom:panel:board_list" },
        ],
      });
      if (summary && !dashboardResult.ok) {
        const kind = getPageFailureKind(dashboardResult);
        addSummaryFailure(summary, {
          kind,
          base: "auth",
          path: dashboardResult.path,
          asset: null,
          status: dashboardResult.responseStatus ?? null,
          markerExpected: dashboardResult.markersExpected ?? null,
          missing: dashboardResult.missingMarker ?? null,
        });
      }
      if (assetsMode && dashboardResult.ok && dashboardResult.html) {
        const assetPaths = extractNextAssetsFromHtml(dashboardResult.html, maxAssets);
        const assetResult = await probeAssets({
          baseUrl: authBaseUrl,
          pagePath: dashboardResult.path,
          assetPaths,
          timeoutMs: assetTimeoutMs,
          ctx: authCtx,
        });
        if (summary && !assetResult.ok) {
          addSummaryFailure(summary, {
            kind: "asset_missing",
            base: "auth",
            path: dashboardResult.path,
            asset: assetResult.assetPath ?? null,
            status: assetResult.status ?? null,
            markerExpected: null,
          });
        }
      }

      const wallResult = await probeHtmlPage({
        baseUrl: authBaseUrl,
        path: `/dashboard/boards/${boardId}/walls/${wallId}`,
        ctx: authCtx,
        expectedMarkers: [
          { name: "gom:layout", value: "dashboard" },
          { name: "gom:page", value: "dashboard_wall" },
          { name: "gom:panel:card_list" },
        ],
      });
      if (summary && !wallResult.ok) {
        const kind = getPageFailureKind(wallResult);
        addSummaryFailure(summary, {
          kind,
          base: "auth",
          path: wallResult.path,
          asset: null,
          status: wallResult.responseStatus ?? null,
          markerExpected: wallResult.markersExpected ?? null,
          missing: wallResult.missingMarker ?? null,
        });
      }
      if (assetsMode && wallResult.ok && wallResult.html) {
        const assetPaths = extractNextAssetsFromHtml(wallResult.html, maxAssets);
        const assetResult = await probeAssets({
          baseUrl: authBaseUrl,
          pagePath: wallResult.path,
          assetPaths,
          timeoutMs: assetTimeoutMs,
          ctx: authCtx,
        });
        if (summary && !assetResult.ok) {
          addSummaryFailure(summary, {
            kind: "asset_missing",
            base: "auth",
            path: wallResult.path,
            asset: assetResult.assetPath ?? null,
            status: assetResult.status ?? null,
            markerExpected: null,
          });
        }
      }
    }

    if (!publicBaseUrl) {
      logPageProbe("pages_probe_skipped", { reason: "missing_public_base_url" });
      addSummarySkip(summary, "missing_public_base_url");
    } else if (!shareCode) {
      assertCtx(publicCtx, ["shareCode"], { stage: "pages_probe", soft: true });
      logPageProbe("pages_probe_skipped", { reason: "missing_share_code" });
      addSummarySkip(summary, "missing_share_code");
    } else {
      if (assetsMode) {
        await ensureBuildId(publicBaseUrl);
      }
      const shareResult = await probeHtmlPage({
        baseUrl: publicBaseUrl,
        path: `/s/${shareCode}`,
        ctx: publicCtx,
        expectedMarkers: [
          { name: "gom:layout", value: "share" },
          { name: "gom:page", value: "share_root" },
          { name: "gom:panel:student_wall" },
        ],
      });
      if (summary && !shareResult.ok) {
        const kind = getPageFailureKind(shareResult);
        addSummaryFailure(summary, {
          kind,
          base: "public",
          path: shareResult.path,
          asset: null,
          status: shareResult.responseStatus ?? null,
          markerExpected: shareResult.markersExpected ?? null,
          missing: shareResult.missingMarker ?? null,
        });
      }
      if (assetsMode && shareResult.ok && shareResult.html) {
        const assetPaths = extractNextAssetsFromHtml(shareResult.html, maxAssets);
        const assetResult = await probeAssets({
          baseUrl: publicBaseUrl,
          pagePath: shareResult.path,
          assetPaths,
          timeoutMs: assetTimeoutMs,
          ctx: publicCtx,
        });
        if (summary && !assetResult.ok) {
          addSummaryFailure(summary, {
            kind: "asset_missing",
            base: "public",
            path: shareResult.path,
            asset: assetResult.assetPath ?? null,
            status: assetResult.status ?? null,
            markerExpected: null,
          });
        }
      }

      const presentResult = await probeHtmlPage({
        baseUrl: publicBaseUrl,
        path: `/s/${shareCode}/present`,
        ctx: publicCtx,
        expectedMarkers: [
          { name: "gom:layout", value: "share" },
          { name: "gom:page", value: "share_present" },
          { name: "gom:panel:present_hud" },
        ],
      });
      if (summary && !presentResult.ok) {
        const kind = getPageFailureKind(presentResult);
        addSummaryFailure(summary, {
          kind,
          base: "public",
          path: presentResult.path,
          asset: null,
          status: presentResult.responseStatus ?? null,
          markerExpected: presentResult.markersExpected ?? null,
          missing: presentResult.missingMarker ?? null,
        });
      }
      if (assetsMode && presentResult.ok && presentResult.html) {
        const assetPaths = extractNextAssetsFromHtml(presentResult.html, maxAssets);
        const assetResult = await probeAssets({
          baseUrl: publicBaseUrl,
          pagePath: presentResult.path,
          assetPaths,
          timeoutMs: assetTimeoutMs,
          ctx: publicCtx,
        });
        if (summary && !assetResult.ok) {
          addSummaryFailure(summary, {
            kind: "asset_missing",
            base: "public",
            path: presentResult.path,
            asset: assetResult.assetPath ?? null,
            status: assetResult.status ?? null,
            markerExpected: null,
          });
        }
      }
    }

    const getContractExpected = (endpointKey) =>
      contractHashBaseline && contractHashBaseline[endpointKey] ? contractHashBaseline[endpointKey] : null;

    if (contractHashMode && authBaseUrl) {
      const authBaseKey = baseKeyForUrl(authBaseUrl, authBaseUrl, publicBaseUrl) ?? "auth";

      await probeContractHash({
        baseUrl: authBaseUrl,
        path: "/api/v1/dashboard/boards",
        endpointKey: "dashboardBoards",
        expected: getContractExpected("dashboardBoards"),
        baseKey: authBaseKey,
        summary,
        allowUnauthorized: true,
        updateBaseline: updateContractHashBaseline,
        baselineUpdates: contractHashUpdates,
        failOnMismatch: failOnContractHashMismatch,
        ctx: authCtx,
      });

      if (boardId) {
        await probeContractHash({
          baseUrl: authBaseUrl,
          path: `/api/v1/boards/${boardId}/me/role`,
          endpointKey: "boardMeRole",
          expected: getContractExpected("boardMeRole"),
          baseKey: authBaseKey,
          summary,
          allowUnauthorized: true,
          updateBaseline: updateContractHashBaseline,
          baselineUpdates: contractHashUpdates,
          failOnMismatch: failOnContractHashMismatch,
          ctx: authCtx,
        });

        await probeContractHash({
          baseUrl: authBaseUrl,
          path: `/api/v1/boards/${boardId}/policy`,
          endpointKey: "boardPolicy",
          expected: getContractExpected("boardPolicy"),
          baseKey: authBaseKey,
          summary,
          allowUnauthorized: true,
          updateBaseline: updateContractHashBaseline,
          baselineUpdates: contractHashUpdates,
          failOnMismatch: failOnContractHashMismatch,
          ctx: authCtx,
        });
      } else {
        ["boardMeRole", "boardPolicy"].forEach((endpointKey) => {
          logApiProbe("api_contract_probe_skipped", { endpointKey, reason: "missing_board_id" });
          addSummarySkip(summary, "missing_board_id");
        });
      }

      if (boardId) {
        await probeContractHash({
          baseUrl: authBaseUrl,
          path: `/api/v1/boards/${boardId}/sessions?limit=1`,
          endpointKey: "boardSessionsList",
          expected: getContractExpected("boardSessionsList"),
          baseKey: authBaseKey,
          summary,
          allowUnauthorized: true,
          updateBaseline: updateContractHashBaseline,
          baselineUpdates: contractHashUpdates,
          failOnMismatch: failOnContractHashMismatch,
          ctx: authCtx,
        });
      } else {
        logApiProbe("api_contract_probe_skipped", { endpointKey: "boardSessionsList", reason: "missing_board_id" });
        addSummarySkip(summary, "missing_board_id");
      }

      if (boardId && wallId) {
        await probeContractHash({
          baseUrl: authBaseUrl,
          path: `/api/v1/dashboard/walls/${wallId}/grid?boardId=${boardId}&limit=1`,
          endpointKey: "dashboardWallGrid",
          expected: getContractExpected("dashboardWallGrid"),
          baseKey: authBaseKey,
          summary,
          allowUnauthorized: true,
          updateBaseline: updateContractHashBaseline,
          baselineUpdates: contractHashUpdates,
          failOnMismatch: failOnContractHashMismatch,
          ctx: authCtx,
        });
      } else {
        logApiProbe("api_contract_probe_skipped", {
          endpointKey: "dashboardWallGrid",
          reason: boardId ? "missing_wall_id" : "missing_board_id",
        });
        addSummarySkip(summary, boardId ? "missing_wall_id" : "missing_board_id");
      }

      if (boardId) {
        const payload = {
          boardId,
          filename: "selfcheck-probe.txt",
          mime: "text/plain",
          bytesOriginal: 1,
          bytesStored: 1,
          contentHash: "0000000000000000000000000000000000000000000000000000000000000000",
        };
        await probeContractHash({
          baseUrl: authBaseUrl,
          path: "/api/v1/files/prepare",
          endpointKey: "filesPrepare",
          expected: getContractExpected("filesPrepare"),
          baseKey: authBaseKey,
          summary,
          allowUnauthorized: true,
          requestInit: {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          },
          updateBaseline: updateContractHashBaseline,
          baselineUpdates: contractHashUpdates,
          failOnMismatch: failOnContractHashMismatch,
          ctx: authCtx,
        });
      } else {
        logApiProbe("api_contract_probe_skipped", { endpointKey: "filesPrepare", reason: "missing_board_id" });
        addSummarySkip(summary, "missing_board_id");
      }

      if (fileId) {
        await probeContractHash({
          baseUrl: authBaseUrl,
          path: `/api/v1/files/${fileId}`,
          endpointKey: "filesMeta",
          expected: getContractExpected("filesMeta"),
          baseKey: authBaseKey,
          summary,
          allowUnauthorized: true,
          updateBaseline: updateContractHashBaseline,
          baselineUpdates: contractHashUpdates,
          failOnMismatch: failOnContractHashMismatch,
          ctx: authCtx,
        });
      } else {
        assertCtx(authCtx, ["fileId"], { stage: "contract_hash_probe", soft: true });
        logApiProbe("api_contract_probe_skipped", { endpointKey: "filesMeta", reason: "missing_file_id" });
        addSummarySkip(summary, "missing_file_id");
      }
    } else if (authBaseUrl) {
      const authBaseKey = baseKeyForUrl(authBaseUrl, authBaseUrl, publicBaseUrl) ?? "auth";
      await probeSchemaVersion({
        baseUrl: authBaseUrl,
        path: "/api/v1/dashboard/boards",
        expected: SCHEMA_VERSIONS.dashboardBoards,
        baseKey: authBaseKey,
        summary,
        allowUnauthorized: true,
        ctx: authCtx,
      });
    }

    if (contractHashMode && publicBaseUrl && shareCode) {
      const publicBaseKey = baseKeyForUrl(publicBaseUrl, authBaseUrl, publicBaseUrl) ?? "public";

      await probeContractHash({
        baseUrl: publicBaseUrl,
        path: `/api/v1/share/${shareCode}/settings`,
        endpointKey: "shareSettings",
        expected: getContractExpected("shareSettings"),
        baseKey: publicBaseKey,
        summary,
        allowUnauthorized: false,
        updateBaseline: updateContractHashBaseline,
        baselineUpdates: contractHashUpdates,
        failOnMismatch: failOnContractHashMismatch,
        ctx: publicCtx,
      });

      await probeContractHash({
        baseUrl: publicBaseUrl,
        path: `/api/v1/share/${shareCode}/present`,
        endpointKey: "sharePresent",
        expected: getContractExpected("sharePresent"),
        baseKey: publicBaseKey,
        summary,
        allowUnauthorized: false,
        updateBaseline: updateContractHashBaseline,
        baselineUpdates: contractHashUpdates,
        failOnMismatch: failOnContractHashMismatch,
        ctx: publicCtx,
      });

      await probeContractHash({
        baseUrl: publicBaseUrl,
        path: `/api/v1/share/${shareCode}/feed?limit=1`,
        endpointKey: "shareFeed",
        expected: getContractExpected("shareFeed"),
        baseKey: publicBaseKey,
        summary,
        allowUnauthorized: false,
        updateBaseline: updateContractHashBaseline,
        baselineUpdates: contractHashUpdates,
        failOnMismatch: failOnContractHashMismatch,
        ctx: publicCtx,
      });
    } else if (publicBaseUrl && shareCode) {
      const publicBaseKey = baseKeyForUrl(publicBaseUrl, authBaseUrl, publicBaseUrl) ?? "public";
      await probeSchemaVersion({
        baseUrl: publicBaseUrl,
        path: `/api/v1/share/${shareCode}/present`,
        expected: SCHEMA_VERSIONS.sharePresent,
        baseKey: publicBaseKey,
        summary,
        allowUnauthorized: false,
        ctx: publicCtx,
      });
    } else if (contractHashMode && publicBaseUrl) {
      ["shareSettings", "sharePresent", "shareFeed"].forEach((endpointKey) => {
        logApiProbe("api_contract_probe_skipped", { endpointKey, reason: "missing_share_code" });
        addSummarySkip(summary, "missing_share_code");
      });
    }
  }

  if (!jsonSummary) {
    runAuthSmoke();
  }

  if (updateContractHashBaseline) {
    writeContractHashBaseline(contractHashUpdates);
    if (!jsonSummary) {
      const baselineKeys = Object.keys(contractHashUpdates ?? {});
      const originalKeys = Object.keys(contractHashBaseline ?? {});
      const combinedKeys = new Set([...baselineKeys, ...originalKeys]);
      let updatedCount = 0;
      let keptCount = 0;
      for (const key of combinedKeys) {
        const before = contractHashBaseline?.[key];
        const after = contractHashUpdates?.[key];
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          updatedCount += 1;
        } else {
          keptCount += 1;
        }
      }
      console.log(
        `[selfcheck:probe] contract hash baseline updated: ${updatedCount} updated, ${keptCount} kept.`
      );
    }
  }

  if (summary) {
    const hasFailures = summary.failedCount > 0;
    const skipOnly = !hasFailures && summary.skippedCount > 0;
    summary.ok = !hasFailures;
    if (softMode && skipOnly) {
      summary.ok = true;
    }
    if (strictMode && hasFailures) {
      summary.ok = false;
    }
    attachSummaryCtx();
    console.log(JSON.stringify(summary));
    process.exit(summary.ok ? 0 : 1);
  }
};

run().catch((error) => {
  if (jsonSummary) {
    const summary = createSummary();
    summary.ok = false;
    summary.ctx = lastProbeCtx
      ? { auth: summarizeCtx(lastProbeCtx.auth), public: summarizeCtx(lastProbeCtx.public) }
      : null;
    addSummaryNote(summary, "probe_failed");
    addSummaryFailure(summary, {
      kind: "http_status",
      base: "public",
      path: null,
      asset: null,
      status: null,
      markerExpected: null,
    });
    console.log(JSON.stringify(summary));
    process.exit(1);
  } else {
    console.error("[selfcheck:probe] Failed", error);
    process.exit(1);
  }
});
