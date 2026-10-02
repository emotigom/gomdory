import { buildStudentAppFileR2Key } from "@/lib/student-apps/studentAppStorageKeys";
import { GKRRY_HOSTS, GOMDORY_HOSTS } from "@/lib/routing/host";

type QueryError = { message?: string } | null;

type DeploymentRow = {
  id: string;
  r2_prefix: string;
  entry_file: string;
  manifest: {
    entryFile?: string;
    files?: Array<{ path?: string; contentType?: string }>;
  } | null;
  title: string;
  status: string;
  published_at: string | null;
};

type DeploymentQueryBuilder = {
  eq: (column: string, value: string) => DeploymentQueryBuilder;
  is: (column: string, value: null) => DeploymentQueryBuilder;
  not: (column: string, operator: string, value: null) => DeploymentQueryBuilder;
  maybeSingle: () => Promise<{ data: DeploymentRow | null; error: QueryError }>;
};

type SupabaseLike = {
  from: (table: string) => {
    select: (query: string) => DeploymentQueryBuilder;
  };
};

const SAFE_DEPLOYMENT_ID_RE = /^[a-zA-Z0-9_-]{6,128}$/;
const BLOCKED_HOSTS = new Set(["gomdory.com", "gkrry.com", "www.gkrry.com"]);
const ALLOWED_HOST = "eduview.gkrry.com";
// Keep this explicit: public student work is only embedded by our production
// board origins and the existing trusted preview origin, never by a wildcard.
const STUDENT_APP_FRAME_ANCESTORS = [...GKRRY_HOSTS, ...GOMDORY_HOSTS]
  .map((host) => `https://${host}`)
  .concat("https://gom-clean-preview.ahnsangkyoon.workers.dev")
  .join(" ");

function normalizeHost(host?: string | null): string {
  return (host ?? "").split(":")[0]?.trim().toLowerCase() ?? "";
}

function isAllowedHost(host?: string | null): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return true;
  if (normalized === ALLOWED_HOST) return true;
  if (normalized === "localhost" || normalized === "127.0.0.1") return true;
  if (normalized.endsWith(".localhost")) return true;
  return !BLOCKED_HOSTS.has(normalized) ? false : false;
}

function resolveAssetPath(parts?: string[]): { ok: true; path: string } | { ok: false } {
  if (!parts || parts.length === 0 || parts.every((p) => !p || !p.trim())) return { ok: true, path: "index.html" };
  const joined = parts.join("/").replace(/\/+/g, "/").trim();
  if (!joined || joined.startsWith("/") || joined.includes("\\") || joined.includes("..") || /[\u0000-\u001F\u007F]/.test(joined)) {
    return { ok: false };
  }
  return { ok: true, path: joined };
}

export async function resolvePublishedStudentAppAsset(input: {
  supabase: SupabaseLike;
  bucket: R2Bucket | null | undefined;
  deploymentId: string;
  assetPath?: string[];
  host?: string | null;
}) {
  if (!isAllowedHost(input.host)) return { ok: false as const, reason: "invalid_host" as const };
  if (!SAFE_DEPLOYMENT_ID_RE.test((input.deploymentId ?? "").trim())) return { ok: false as const, reason: "invalid_deployment_id" as const };

  const resolved = resolveAssetPath(input.assetPath);
  if (!resolved.ok) return { ok: false as const, reason: "invalid_asset_path" as const };

  const query = input.supabase
    .from("student_app_deployments")
    .select("id, r2_prefix, entry_file, manifest, title, status, published_at")
    .eq("id", input.deploymentId)
    .eq("status", "published")
    .is("deleted_at", null)
    .not("published_at", "is", null);

  const deploymentRes = await query.maybeSingle();
  if (deploymentRes.error || !deploymentRes.data) return { ok: false as const, reason: "not_found" as const };

  const deployment = deploymentRes.data;
  const manifestFiles = deployment.manifest?.files ?? [];
  const reqPath = resolved.path;
  const isIndex = reqPath === "index.html";
  const entryFile = (deployment.entry_file || deployment.manifest?.entryFile || "").trim();

  if (isIndex) {
    if (!entryFile || entryFile !== "index.html") return { ok: false as const, reason: "not_found" as const };
  } else {
    const inManifest = manifestFiles.some((file: { path?: string }) => file?.path === reqPath);
    if (!inManifest) return { ok: false as const, reason: "not_found" as const };
  }

  if (!input.bucket) return { ok: false as const, reason: "storage_unavailable" as const };

  const key = buildStudentAppFileR2Key(deployment.r2_prefix, reqPath);
  const object = await input.bucket.get(key);
  if (!object || !object.body) return { ok: false as const, reason: "not_found" as const };

  const manifestType = manifestFiles.find((file: { path?: string; contentType?: string }) => file?.path === reqPath)?.contentType;
  const contentType = object.httpMetadata?.contentType || manifestType || "application/octet-stream";
  const isHtml = reqPath.endsWith(".html");
  const cacheControl = isHtml ? "public, max-age=60, must-revalidate" : "public, max-age=31536000, immutable";
  const headers: Record<string, string> = {
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), clipboard-read=(), clipboard-write=()",
    "cross-origin-opener-policy": "same-origin",
    "cross-origin-resource-policy": "same-origin",
  };

  if (isHtml) {
    headers["content-disposition"] = "inline";
    headers["content-security-policy"] = `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; form-action 'none'; base-uri 'none'; object-src 'none'; frame-ancestors ${STUDENT_APP_FRAME_ANCESTORS};`;
  }

  return {
    ok: true as const,
    body: object.body,
    contentType,
    cacheControl,
    headers,
  };
}
