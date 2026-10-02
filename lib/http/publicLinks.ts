import { SHORT_BASE_URL } from "./siteConfig";
import {
  getGridUrl,
  getJoinEntryUrl,
  getProjectorUrl,
  getShowUrl,
  getSlidesUrl,
  getStudentUrl,
} from "@/lib/share/shareUrls";

function normalizeProto(origin: string, proto?: string): string {
  if (!proto) return origin;
  try {
    const url = new URL(origin);
    url.protocol = `${proto}:`;
    return url.origin;
  } catch {
    return origin;
  }
}

function normalizePath(path: string): string {
  if (!path.startsWith("/")) {
    return `/${path}`;
  }
  return path;
}

export function buildStudentUrl(path: string, proto: string = "https"): string {
  const origin = normalizeProto(SHORT_BASE_URL, proto);
  return `${origin}${normalizePath(path)}`;
}

export function buildShareUrl(code: string, proto?: string): string {
  const url = getStudentUrl(code);
  return normalizeProto(url, proto);
}

export function buildPresentUrl(code: string, proto?: string): string {
  const url = getProjectorUrl(code);
  return normalizeProto(url, proto);
}

export function buildShowUrl(code: string, proto?: string): string {
  const url = getShowUrl(code);
  return normalizeProto(url, proto);
}

export function buildSlidesUrl(code: string, proto?: string): string {
  const url = getSlidesUrl(code);
  return normalizeProto(url, proto);
}

export function buildGridUrl(code: string, proto?: string): string {
  const url = getGridUrl(code);
  return normalizeProto(url, proto);
}

export function buildClipUrl(token: string, proto?: string): string {
  return buildStudentUrl(`/c/${token}`, proto);
}

export function buildShowcaseUrl(token: string, proto?: string): string {
  return buildStudentUrl(`/x/${token}`, proto);
}

export function buildExhibitUrl(token: string, proto?: string): string {
  return buildStudentUrl(`/e/${token}`, proto);
}

export function buildJoinUrl(code?: string, proto?: string): string {
  if (!code) {
    return normalizeProto(getJoinEntryUrl(), proto);
  }
  const params = new URLSearchParams({ code });
  return buildStudentUrl(`/join?${params.toString()}`, proto);
}
