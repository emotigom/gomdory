import { AwsClient } from "aws4fetch";
import { parseBool } from "@/lib/env/parseBool";
import { GOMDORY_HOSTS } from "@/lib/routing/host";
import { guessContentType } from "./mime";

type R2Config = {
  endpoint: string;
  bucket: string;
  client: AwsClient;
};

type EduViewEnv = {
  EDU_VISIBILITY_KV?: KVNamespace;
};

const SLUG_REGEX = /^[a-z0-9-]{4,64}$/;
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cross-Origin-Resource-Policy": "cross-origin",
  "Cross-Origin-Opener-Policy": "same-origin",
  "X-Robots-Tag": "noindex",
};

let cachedConfig: R2Config | null = null;

function getEnvValue(key: "R2_ACCOUNT_ID" | "R2_BUCKET" | "R2_ACCESS_KEY_ID" | "R2_SECRET_ACCESS_KEY"): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing R2 env var: ${key}`);
  }
  return value;
}

function getR2Config(): R2Config {
  if (cachedConfig) {
    return cachedConfig;
  }

  const accountId = getEnvValue("R2_ACCOUNT_ID");
  const bucket = getEnvValue("R2_BUCKET");
  const accessKeyId = getEnvValue("R2_ACCESS_KEY_ID");
  const secretAccessKey = getEnvValue("R2_SECRET_ACCESS_KEY");

  cachedConfig = {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    bucket,
    client: new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    }),
  };

  return cachedConfig;
}

function encodeR2Key(key: string): string {
  return key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildCspHeader(): string {
  const allowNetwork = parseBool(process.env.EDU_ALLOW_NETWORK, false);
  const connect = allowNetwork ? "connect-src https:" : "connect-src 'none'";
  const form = allowNetwork ? "form-action https:" : "form-action 'none'";
  const frameAncestors = `frame-ancestors ${Array.from(GOMDORY_HOSTS).map((host) => `https://${host}`).join(" ")}`;
  return [
    "default-src 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    frameAncestors,
    "img-src https: data:",
    "script-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
    "style-src 'self' 'unsafe-inline'",
    "font-src https: data:",
    connect,
    form,
  ].join("; ");
}

function applySecurityHeaders(headers: Headers): void {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
  headers.set("Content-Security-Policy", buildCspHeader());
}

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  applySecurityHeaders(headers);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildTextResponse(message: string, status: number): Response {
  return withSecurityHeaders(
    new Response(message, {
      status,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    }),
  );
}

async function fetchR2Object(method: "GET" | "HEAD", key: string, range?: string | null): Promise<Response> {
  const { endpoint, bucket, client } = getR2Config();
  const objectUrl = `${endpoint}/${bucket}/${encodeR2Key(key)}`;
  const headers: Record<string, string> = {};
  if (range && method === "GET") {
    headers.Range = range;
  }
  const signed = await client.sign(objectUrl, { method, headers });
  return fetch(signed);
}

export async function serveEduView(request: Request, ctx: ExecutionContext, env?: EduViewEnv): Promise<Response> {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return buildTextResponse("Method Not Allowed", 405);
  }

  const url = new URL(request.url);

  if (url.pathname === "/") {
    return buildTextResponse("EduView legacy endpoint. Use /v1/health/visibility for health.", 200);
  }

  if (url.pathname === "/v1/health/visibility") {
    if (env?.EDU_VISIBILITY_KV) {
      return buildTextResponse("ok", 200);
    }
    return buildTextResponse("disabled", 404);
  }

  if (!url.pathname.startsWith("/v1/")) {
    return buildTextResponse("Not Found", 404);
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const version = segments[0];
  const slug = segments[1];
  const restSegments = segments.slice(2);

  if (version !== "v1" || !slug || !SLUG_REGEX.test(slug)) {
    return buildTextResponse("Not Found", 404);
  }

  if (env?.EDU_VISIBILITY_KV) {
    const hidden = await env.EDU_VISIBILITY_KV.get(`edu:hidden:${slug}`, { cacheTtl: 60 });
    if (hidden) {
      return buildTextResponse("Hidden", 451);
    }
  }

  for (const segment of restSegments) {
    if (segment.includes("..") || segment.includes("\\")) {
      return buildTextResponse("Bad Request", 400);
    }
  }

  const endsWithSlash = url.pathname.endsWith("/");
  let restPath = restSegments.join("/");

  if (!restPath) {
    restPath = "index.html";
  } else if (endsWithSlash) {
    restPath = `${restPath}/index.html`;
  }

  const shouldFallbackToRoot = restSegments.length === 0 || endsWithSlash;

  const range = request.headers.get("range");
  const cache = caches.default;
  const cacheKey = request.method === "GET" && !range ? new Request(url.toString(), { method: "GET" }) : null;

  if (cacheKey) {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return cached;
    }
  }

  const method = request.method as "GET" | "HEAD";
  let response = await fetchR2Object(method, `edu/v1/${slug}/${restPath}`, range);
  let resolvedPath = restPath;

  if (response.status === 404 && restPath !== "index.html" && shouldFallbackToRoot) {
    response = await fetchR2Object(method, `edu/v1/${slug}/index.html`, range);
    resolvedPath = "index.html";
  }

  if (response.status === 404) {
    return buildTextResponse("Not Found", 404);
  }

  if (!response.ok) {
    return buildTextResponse("Upstream Error", response.status);
  }

  const headers = new Headers(response.headers);
  if (!headers.get("Content-Type")) {
    headers.set("Content-Type", guessContentType(resolvedPath));
  }

  headers.set("Cache-Control", "public, max-age=604800");
  applySecurityHeaders(headers);

  const finalResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  if (cacheKey && finalResponse.status === 200) {
    ctx.waitUntil(cache.put(cacheKey, finalResponse.clone()));
  }

  return finalResponse;
}
