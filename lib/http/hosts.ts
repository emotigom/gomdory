import { redirect } from "next/navigation";

import { SHORT_PREFERRED_HOST, TEACHER_CANONICAL_HOST } from "./siteConfig";
import { getRequestHost } from "./requestHost";

export const TEACHER_HOST = TEACHER_CANONICAL_HOST;
export const STUDENT_HOST = SHORT_PREFERRED_HOST;
export const TRUSTED_PREVIEW_HOST = "gom-clean-preview.ahnsangkyoon.workers.dev";
export const TRUSTED_TEACHER_PREVIEW_HOST = TRUSTED_PREVIEW_HOST;
export const TRUSTED_STUDENT_PREVIEW_HOST = TRUSTED_PREVIEW_HOST;

/**
 * The teacher preview is an explicit deployment allowlist entry, not a workers.dev pattern.
 * Callers must pass a hostname (without a port).
 */
export function isTrustedTeacherPreviewHost(hostname: string): boolean {
  return hostname.trim().toLowerCase() === TRUSTED_TEACHER_PREVIEW_HOST;
}

/**
 * The student preview is an explicit deployment allowlist entry, not a workers.dev pattern.
 * Callers must pass a hostname (without a port).
 */
export function isTrustedStudentPreviewHost(hostname: string): boolean {
  return hostname.trim().toLowerCase() === TRUSTED_STUDENT_PREVIEW_HOST;
}

function isLocalHost(host: string): boolean {
  const lowered = host.toLowerCase();
  return (
    lowered === "localhost" ||
    lowered === "127.0.0.1" ||
    lowered.endsWith(".local")
  );
}

function shouldBypassHostGuard(host: string): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  if (process.env.HOST_GUARD_MODE === "off") {
    return true;
  }

  return isLocalHost(host);
}

export async function getHost(): Promise<string> {
  return getRequestHost();
}

export function getHostRedirectTarget({
  desiredHost,
  currentHost,
  requestUrl,
}: {
  desiredHost: string;
  currentHost: string;
  requestUrl: URL;
}): string | null {
  if (!currentHost || currentHost === desiredHost) {
    return null;
  }

  if (desiredHost === STUDENT_HOST && isTrustedStudentPreviewHost(currentHost)) {
    return null;
  }

  return `https://${desiredHost}${requestUrl.pathname}${requestUrl.search}`;
}

export async function redirectToHostIfNeeded({
  desiredHost,
  requestUrl,
}: {
  desiredHost: string;
  requestUrl: URL;
}) {
  const host = await getHost();

  if (shouldBypassHostGuard(host)) {
    return;
  }

  const redirectTarget = getHostRedirectTarget({
    desiredHost,
    currentHost: host,
    requestUrl,
  });

  if (!redirectTarget) {
    return;
  }

  redirect(redirectTarget);
}
