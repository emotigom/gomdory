import { resolveJoinTokenFromRequest } from "@/lib/edu/joinTokenRequest";
import { isSampleLessonPath } from "@/lib/server/eduGating";

const parseUrlLike = (value: string | null | undefined): URL | null => {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
};

const isDemoLessonPath = (pathname: string | null | undefined): boolean => {
  return isSampleLessonPath(pathname);
};

export const resolveWebllmDownloadPolicyFromRequest = (request: Request) => {
  const directUrl = new URL(request.url);
  const refererUrl = parseUrlLike(request.headers.get("referer"));
  const candidates = [directUrl, refererUrl].filter((item): item is URL => Boolean(item));
  const matched = candidates.find((url) => isDemoLessonPath(url.pathname));
  const sourceUrl = matched ?? directUrl;
  const joinToken = resolveJoinTokenFromRequest(request);
  const hasJoinToken = Boolean(joinToken);
  const downloadAllowed = !isDemoLessonPath(sourceUrl.pathname) || hasJoinToken;

  return {
    pathname: sourceUrl.pathname,
    hasJoinToken,
    downloadAllowed,
    reason: downloadAllowed ? "allowed" : "demo_sample_download_block",
  } as const;
};
