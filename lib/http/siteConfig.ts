import { readSiteCanonicalUrl, readSiteShortUrl } from "@/lib/env/appConfig";
import { apiV1Path } from "@/lib/standards/pathTypes";

import {
  GKRRY_CANONICAL_HOST,
  GKRRY_HOSTS,
  GOMDORY_CANONICAL_HOST,
  GOMDORY_HOSTS,
  normalizeHost,
} from "@/lib/routing/host";
import { isShareCodePath } from "@/lib/share/shareCode";
import { isLikelyShareCode } from "@/lib/student/shareCode";

const DEFAULT_CANONICAL_URL = "https://www.gomdory.com";
const DEFAULT_SHORT_URL = "https://www.gkrry.com";

export const TEACHER_CANONICAL_HOST = GOMDORY_CANONICAL_HOST;
export const TEACHER_ALT_HOSTS = new Set(
  Array.from(GOMDORY_HOSTS).filter((host) => host !== GOMDORY_CANONICAL_HOST),
);
export const SHORT_PREFERRED_HOST = GKRRY_CANONICAL_HOST;
export const SHORT_HOSTS = GKRRY_HOSTS;
export const BLOCKED_HOSTS = new Set(["gomdori.com", "www.gomdori.com"]);

function normalizeBaseUrl(raw: string | undefined, fallback: string) {
  if (!raw) {
    return fallback;
  }

  try {
    const withProtocol = raw.startsWith("http") ? raw : `https://${raw}`;
    const origin = new URL(withProtocol).origin;
    const host = normalizeHost(new URL(origin).host);
    if (BLOCKED_HOSTS.has(host)) {
      return fallback;
    }
    return origin;
  } catch {
    return fallback;
  }
}

export const CANONICAL_BASE_URL = normalizeBaseUrl(readSiteCanonicalUrl(), DEFAULT_CANONICAL_URL);

export const SHORT_BASE_URL = normalizeBaseUrl(readSiteShortUrl(), DEFAULT_SHORT_URL);

export const CANONICAL_HOST = TEACHER_CANONICAL_HOST;
export const SHORT_HOST = SHORT_PREFERRED_HOST;

const STUDENT_PATH_PREFIXES = [
  "/s",
  "/c",
  "/k",
  "/x",
  "/e",
  "/join",
  "/r",
  apiV1Path("s"),
  apiV1Path("c"),
  apiV1Path("k"),
  apiV1Path("r"),
  apiV1Path("share"),
];
const SENSITIVE_PATH_PREFIXES = ["/dashboard", "/auth", "/invite", "/api", "/templates", "/edu"];
const PUBLIC_API_PREFIXES = ["/api/public", apiV1Path("public")];
const REDIRECT_EXEMPT_PREFIXES = ["/__health", "/api/health", "/_next/", "/favicon", "/robots.txt"];
const SHORT_HOST_ALLOWED_PREFIXES = [
  apiV1Path("ops"),
  apiV1Path("ops/ui-error"),
  apiV1Path("ops/log"),
  apiV1Path("ops/ping"),
  apiV1Path("ops/ui-slow"),
  apiV1Path("ops/banner"),
  apiV1Path("system/diag"),
  apiV1Path("public/report"),
  apiV1Path("public/exhibits"),
  apiV1Path("share"),
  "/p",
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isTeacherHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return normalized === TEACHER_CANONICAL_HOST || TEACHER_ALT_HOSTS.has(normalized);
}

export function isShortHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return SHORT_HOSTS.has(normalized);
}

export function isShortHostAllowedPath(pathname: string): boolean {
  const lowerPath = pathname.toLowerCase();
  return SHORT_HOST_ALLOWED_PREFIXES.some((prefix) => pathMatchesPrefix(lowerPath, prefix));
}

export function isShortHostStudentEntryPath(pathname: string): boolean {
  const lowerPath = pathname.toLowerCase();

  if (lowerPath === "/") {
    return true;
  }

  const segments = lowerPath.split("/").filter(Boolean);
  if (segments.length === 1 && isLikelyShareCode(segments[0] ?? "")) {
    return true;
  }

  return STUDENT_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(lowerPath, prefix));
}

export function isBlockedHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return BLOCKED_HOSTS.has(normalized);
}

export function assertRedirectHostAllowed(targetHost: string): string {
  const normalized = normalizeHost(targetHost);
  if (!normalized || isBlockedHost(normalized)) {
    return TEACHER_CANONICAL_HOST;
  }

  if (
    normalized === TEACHER_CANONICAL_HOST ||
    TEACHER_ALT_HOSTS.has(normalized) ||
    SHORT_HOSTS.has(normalized)
  ) {
    return normalized;
  }

  return TEACHER_CANONICAL_HOST;
}

export function getTeacherCanonicalOrigin(proto: string = "https"): string {
  return `${proto}://${TEACHER_CANONICAL_HOST}`;
}

export function getShortPreferredOrigin(proto: string = "https"): string {
  return `${proto}://${SHORT_PREFERRED_HOST}`;
}

export function isRedirectExempt(pathname: string): boolean {
  const lowerPath = pathname.toLowerCase();
  return REDIRECT_EXEMPT_PREFIXES.some((prefix) => pathMatchesPrefix(lowerPath, prefix));
}

export function isStudentPath(pathname: string): boolean {
  const lowerPath = pathname.toLowerCase();
  if (STUDENT_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(lowerPath, prefix))) {
    return true;
  }

  return isShareCodePath(lowerPath);
}

export function isSensitivePath(pathname: string): boolean {
  if (isRedirectExempt(pathname)) {
    return false;
  }

  const lowerPath = pathname.toLowerCase();

  if (isStudentPath(lowerPath)) {
    return false;
  }

  if (isShortHostAllowedPath(lowerPath)) {
    return false;
  }

  if (PUBLIC_API_PREFIXES.some((prefix) => pathMatchesPrefix(lowerPath, prefix))) {
    return false;
  }

  return SENSITIVE_PATH_PREFIXES.some((prefix) => pathMatchesPrefix(lowerPath, prefix));
}

export function prefersShortHost(pathname: string): boolean {
  return isStudentPath(pathname);
}

export function mustUseCanonical(pathname: string): boolean {
  if (isRedirectExempt(pathname)) {
    return false;
  }

  if (isShortHostAllowedPath(pathname)) {
    return false;
  }

  if (isSensitivePath(pathname)) {
    return true;
  }

  if (isStudentPath(pathname)) {
    return false;
  }

  return true;
}
