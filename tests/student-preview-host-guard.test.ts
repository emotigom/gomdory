import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  getHostRedirectTarget,
  isTrustedStudentPreviewHost,
  STUDENT_HOST,
  TRUSTED_STUDENT_PREVIEW_HOST,
} from "@/lib/http/hosts";
import { buildShareUrl } from "@/lib/http/publicLinks";
import { SHORT_BASE_URL } from "@/lib/http/siteConfig";
import { getStudentUrl } from "@/lib/share/shareUrls";

const sharePath = "/s/XR52Z4";

test("only the exact student preview hostname bypasses the student canonical redirect", () => {
  assert.equal(isTrustedStudentPreviewHost(TRUSTED_STUDENT_PREVIEW_HOST), true);
  assert.equal(
    getHostRedirectTarget({
      desiredHost: STUDENT_HOST,
      currentHost: TRUSTED_STUDENT_PREVIEW_HOST,
      requestUrl: new URL(sharePath, `https://${TRUSTED_STUDENT_PREVIEW_HOST}`),
    }),
    null,
  );

  for (const hostname of [
    "evil-gom-clean-preview.ahnsangkyoon.workers.dev",
    "gom-clean-preview.ahnsangkyoon.workers.dev.evil.com",
    "gom-clean-preview-example.workers.dev",
    "ahnsangkyoon.workers.dev",
  ]) {
    assert.equal(isTrustedStudentPreviewHost(hostname), false);
  }
});

test("student canonical redirects preserve the share code for non-preview hosts", () => {
  for (const hostname of ["gkrry.com", "gomdory.com", "other.workers.dev"]) {
    assert.equal(
      getHostRedirectTarget({
        desiredHost: STUDENT_HOST,
        currentHost: hostname,
        requestUrl: new URL(sharePath, `https://${hostname}`),
      }),
      `https://${STUDENT_HOST}${sharePath}`,
    );
  }
});

test("student page uses its route code as the redirect fallback when x-url is absent", () => {
  const source = fs.readFileSync("app/s/[code]/page.tsx", "utf8");
  const codeResolution = source.indexOf("const { code } = await params;");
  const hostGuard = source.indexOf("await redirectToHostIfNeeded({");

  assert.ok(codeResolution >= 0 && codeResolution < hostGuard);
  assert.match(source, /requestUrl: new URL\(`\/s\/${encodeURIComponent\(code\)}`/);
  assert.doesNotMatch(source, /requestHeaders\.get\("x-url"\)/);
});

test("student share URL builders use the configured short base URL", () => {
  assert.equal(getStudentUrl("XR52Z4"), `${SHORT_BASE_URL}/XR52Z4`);
  assert.equal(buildShareUrl("XR52Z4"), `${SHORT_BASE_URL}/XR52Z4`);
  assert.equal(
    new URL(buildShareUrl("XR52Z4")).host,
    new URL(SHORT_BASE_URL).host,
  );
});
