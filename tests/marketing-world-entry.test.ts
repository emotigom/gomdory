import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("marketing landing keeps canonical root markers", () => {
  const pagePath = path.join(process.cwd(), "app", "(marketing)", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  // LandingWorldHubTeaser was removed during canonical landing simplification;
  // the stable contract is canonical root ownership/markers rather than legacy component names.
  assert.ok(source.includes('data-testid="marketing-landing-root"'));
  assert.ok(source.includes('data-landing-variant="canonical"'));
  assert.ok(source.includes('data-testid="marketing-landing-canonical"'));
  assert.ok(source.includes('data-testid="marketing-landing-marker-version"'));
  assert.ok(source.includes("MARKETING_HOME_CANONICAL_MARKER_VERSION"));
  assert.equal(
    fs.readFileSync(path.join(process.cwd(), "app", "(marketing)", "_components", "landingMarkerContract.ts"), "utf8").includes('marketing-home-canonical-v4-liberated'),
    true,
  );
});

test("marketing landing keeps teacher-facing copy and disallows unsupported certification claims", () => {
  const pagePath = path.join(process.cwd(), "app", "(marketing)", "page.tsx");
  const source = fs.readFileSync(pagePath, "utf8");

  assert.ok(source.includes("자료를 펼치고,"));
  assert.ok(source.includes("발표를 시작하세요."));
  assert.ok(source.includes("학생 로그인 없이 참여"));
  assert.ok(source.includes("학교 검토 자료 보기"));
  assert.ok(source.includes("개인정보"));

  for (const bannedClaim of ["교육부 인증", "에듀집 승인", "공식 통과", "심의 완료", "인증 획득"]) {
    assert.equal(source.includes(bannedClaim), false, `unsupported claim must stay absent: ${bannedClaim}`);
  }
});

test("marketing landing keeps current secondary entry surface", () => {
  const blocksPath = path.join(process.cwd(), "app", "(marketing)", "_components", "LandingInfoBlocks.tsx");
  const source = fs.readFileSync(blocksPath, "utf8");

  assert.ok(source.includes('data-testid="landing-info-secondary"'));
  assert.ok(source.includes('href="/community"'));
});

test("/world route redirects to /world-hub", () => {
  const worldPath = path.join(process.cwd(), "app", "(marketing)", "world", "page.tsx");
  const source = fs.readFileSync(worldPath, "utf8");

  assert.ok(source.includes('redirect("/world-hub")'));
});
