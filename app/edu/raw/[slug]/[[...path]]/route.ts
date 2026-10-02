import { presignGetUrl } from "@/lib/r2/client";

const SLUG_SAFE_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed || !SLUG_SAFE_REGEX.test(trimmed)) return null;
  return trimmed;
}

function normalizePathSegments(segments?: string[]): string | null {
  if (!segments || segments.length === 0) return "index.html";
  const cleaned = segments.map((segment) => segment.trim()).filter(Boolean);
  if (cleaned.length === 0) return "index.html";
  if (
    cleaned.some(
      (segment) =>
        segment === "." ||
        segment === ".." ||
        segment.includes("..") ||
        segment.includes("\\"),
    )
  ) {
    return null;
  }
  return cleaned.join("/");
}

function buildProxyResponse(response: Response): Response {
  const headers = new Headers();
  const passthroughHeaders = [
    "content-type",
    "content-length",
    "content-language",
    "content-encoding",
    "etag",
    "last-modified",
  ];

  passthroughHeaders.forEach((header) => {
    const value = response.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  });

  headers.set("cache-control", "public, max-age=300");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-robots-tag", "noindex");

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string; path?: string[] }> },
) {
  const { slug: rawSlug, path } = await params;
  const slug = normalizeSlug(rawSlug);
  const assetPath = normalizePathSegments(path);

  if (!slug || !assetPath) {
    return new Response("Not Found", { status: 404 });
  }

  const key = `edu/v1/${slug}/${assetPath}`;

  let signedUrl: string;
  try {
    signedUrl = await presignGetUrl({ key, expiresSeconds: 60 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`R2 설정 필요: ${message}`, { status: 500 });
  }

  const r2Response = await fetch(signedUrl);

  if (r2Response.status === 404) {
    return new Response("Not Found", { status: 404 });
  }

  if (!r2Response.ok) {
    return new Response("Failed to load", { status: 502 });
  }

  return buildProxyResponse(r2Response);
}
