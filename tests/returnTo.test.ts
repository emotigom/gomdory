import assert from "node:assert/strict";
import test from "node:test";

import { normalizeReturnTo } from "@/lib/auth/returnTo";
import { resolveAuthCallbackRedirects } from "@/lib/auth/callbackRedirect";
import { isTrustedTeacherPreviewHost, TRUSTED_TEACHER_PREVIEW_HOST } from "@/lib/http/hosts";
import { SHORT_PREFERRED_HOST, TEACHER_CANONICAL_HOST } from "@/lib/http/siteConfig";

test("external URLs are rejected and fallback is used", () => {
  const result = normalizeReturnTo(TEACHER_CANONICAL_HOST, "https://evil.example.com/path");
  assert.equal(result.path, "/dashboard");
  assert.equal(result.redirectHost, TEACHER_CANONICAL_HOST.toLowerCase());
});

test("javascript, data, and protocol-relative paths are rejected", () => {
  const scriptResult = normalizeReturnTo(null, "javascript:alert(1)");
  assert.equal(scriptResult.path, "/dashboard");
  const dataResult = normalizeReturnTo(null, "data:text/html,unsafe");
  assert.equal(dataResult.path, "/dashboard");
  const protocolRelative = normalizeReturnTo(null, "//evil.example.com/hack");
  assert.equal(protocolRelative.path, "/dashboard");
});

test("relative dashboard paths are preserved", () => {
  const result = normalizeReturnTo(TEACHER_CANONICAL_HOST, "/dashboard");
  assert.equal(result.path, "/dashboard");
  assert.equal(result.redirectHost, TEACHER_CANONICAL_HOST.toLowerCase());
});

test("only the exact teacher preview hostname is trusted", () => {
  assert.equal(isTrustedTeacherPreviewHost(TRUSTED_TEACHER_PREVIEW_HOST), true);
  assert.equal(isTrustedTeacherPreviewHost("evil-gom-clean-preview.ahnsangkyoon.workers.dev"), false);
  assert.equal(isTrustedTeacherPreviewHost("gom-clean-preview.ahnsangkyoon.workers.dev.evil.com"), false);
  assert.equal(isTrustedTeacherPreviewHost("gom-clean-preview-example.workers.dev"), false);
  assert.equal(isTrustedTeacherPreviewHost("ahnsangkyoon.workers.dev"), false);
});

test("trusted preview keeps teacher dashboard return paths on its own origin", () => {
  const dashboard = normalizeReturnTo(TRUSTED_TEACHER_PREVIEW_HOST, "/dashboard");
  assert.equal(dashboard.redirectHost, TRUSTED_TEACHER_PREVIEW_HOST);

  const diagnostics = normalizeReturnTo(
    TRUSTED_TEACHER_PREVIEW_HOST,
    "/dashboard/boards/board-1/lesson-run-diagnostics",
  );
  assert.equal(diagnostics.redirectHost, TRUSTED_TEACHER_PREVIEW_HOST);
});

test("callback success and error redirects keep the trusted preview origin", () => {
  const redirects = resolveAuthCallbackRedirects({
    host: TRUSTED_TEACHER_PREVIEW_HOST,
    proto: "https",
    returnTo: "/dashboard",
  });
  assert.equal(redirects.successUrl.href, `https://${TRUSTED_TEACHER_PREVIEW_HOST}/dashboard`);
  assert.equal(
    redirects.loginUrl.href,
    `https://${TRUSTED_TEACHER_PREVIEW_HOST}/auth/login?returnTo=%2Fdashboard`,
  );
});

test("production callback redirects remain canonical", () => {
  const redirects = resolveAuthCallbackRedirects({
    host: TEACHER_CANONICAL_HOST,
    proto: "https",
    returnTo: "/dashboard",
  });
  assert.equal(redirects.successUrl.href, `https://${TEACHER_CANONICAL_HOST}/dashboard`);
  assert.equal(redirects.loginUrl.origin, `https://${TEACHER_CANONICAL_HOST}`);
});

test("untrusted callback hosts cannot select a redirect origin", () => {
  const redirects = resolveAuthCallbackRedirects({
    host: "evil-gom-clean-preview.ahnsangkyoon.workers.dev",
    proto: "https",
    returnTo: "/dashboard",
  });
  assert.equal(redirects.successUrl.origin, `https://${TEACHER_CANONICAL_HOST}`);
  assert.equal(redirects.loginUrl.origin, `https://${TEACHER_CANONICAL_HOST}`);
});

test("query params and join routes are preserved", () => {
  const dashboardResult = normalizeReturnTo(TEACHER_CANONICAL_HOST, "/dashboard?x=1");
  assert.equal(dashboardResult.path, "/dashboard?x=1");
  assert.equal(dashboardResult.redirectHost, TEACHER_CANONICAL_HOST.toLowerCase());

  const joinResult = normalizeReturnTo(TEACHER_CANONICAL_HOST, "/join?code=aaaaaa");
  assert.equal(joinResult.path, "/join?code=aaaaaa");
  assert.equal(joinResult.redirectHost, TEACHER_CANONICAL_HOST.toLowerCase());
});

test("short-host paths remain on short domain", () => {
  const result = normalizeReturnTo("ignored.host", "/s/abc123");
  assert.equal(result.redirectHost, SHORT_PREFERRED_HOST.toLowerCase());
  assert.equal(result.path, "/s/abc123");
});

test("short-host paths preserve query/hash", () => {
  const result = normalizeReturnTo("ignored.host", "/s/abc123?view=1#tab");
  assert.equal(result.redirectHost, SHORT_PREFERRED_HOST.toLowerCase());
  assert.equal(result.path, "/s/abc123?view=1#tab");
});

test("parent directory paths are rejected", () => {
  const result = normalizeReturnTo(null, "../dashboard");
  assert.equal(result.path, "/dashboard");
});

test("control characters are rejected", () => {
  const result = normalizeReturnTo(null, "\n/dashboard");
  assert.equal(result.path, "/dashboard");
});

test("returnTo query params are normalized safely", () => {
  const safeUrl = new URL("https://example.com/auth/login?returnTo=%2Fdashboard");
  const safeResult = normalizeReturnTo(null, safeUrl.searchParams.get("returnTo"));
  assert.equal(safeResult.path, "/dashboard");

  const unsafeUrl = new URL("https://example.com/auth/login?returnTo=https%3A%2F%2Fevil.com");
  const unsafeResult = normalizeReturnTo(null, unsafeUrl.searchParams.get("returnTo"));
  assert.equal(unsafeResult.path, "/dashboard");
});
