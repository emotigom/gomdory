export type ApiPath = string & { __brand: "ApiPath" };
export type PagePath = string & { __brand: "PagePath" };

const API_V1_PREFIX = "/api/v1";

type UnsafeApiPathMeta = {
  file?: string;
  reason?: string;
};

const isAbsoluteUrl = (value: string) => value.startsWith("http://") || value.startsWith("https://");

export function apiPath(path: string): ApiPath {
  if (isAbsoluteUrl(path)) {
    throw new Error("apiPath expects a same-origin relative path.");
  }
  if (!path.startsWith("/api/")) {
    throw new Error("apiPath expects a path that starts with /api/.");
  }
  return path as ApiPath;
}

export function pagePath(path: string): PagePath {
  return path as PagePath;
}

export function unsafeApiPath(path: string, meta: UnsafeApiPathMeta = {}): ApiPath {
  if (isAbsoluteUrl(path)) {
    throw new Error("unsafeApiPath expects a same-origin relative path.");
  }
  if (!path.startsWith("/api/")) {
    throw new Error("unsafeApiPath expects a path that starts with /api/.");
  }

  if (process.env.NODE_ENV === "development" || process.env.CI) {
    const metaText = [meta.file ? `file=${meta.file}` : null, meta.reason ? `reason=${meta.reason}` : null]
      .filter(Boolean)
      .join(" ");
    console.warn(
      "[unsafeApiPath] 기존 하드코딩 경로, 추후 routes.ts로 이관이 필요합니다.",
      path,
      metaText ? `(${metaText})` : "",
    );
  }

  return path as ApiPath;
}

export function apiV1Path(path: string): ApiPath {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return apiPath(`${API_V1_PREFIX}/${normalized}`);
}
