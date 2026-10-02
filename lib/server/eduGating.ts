const SAMPLE_LESSON_PATH_PATTERN = /^\/edu\/lesson\/(0|1|2|3|4)(\/)?$/;

const normalizePathname = (pathname: string | null | undefined): string => {
  if (!pathname) return "";
  return pathname.replace(/\/+$/, "") || "/";
};

export const isSampleLessonPath = (pathname: string | null | undefined): boolean => {
  return SAMPLE_LESSON_PATH_PATTERN.test(normalizePathname(pathname));
};

export const hasJt = (searchParams: URLSearchParams): boolean => {
  const token = searchParams.get("jt")?.trim();
  return Boolean(token);
};

export const shouldBlockWebllmDownload = (request: Request): boolean => {
  const directUrl = new URL(request.url);
  return isSampleLessonPath(directUrl.pathname) && !hasJt(directUrl.searchParams);
};

export const parseBooleanEnvValue = (
  value: string | null | undefined,
  fallback = false,
): boolean => {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return fallback;
};
