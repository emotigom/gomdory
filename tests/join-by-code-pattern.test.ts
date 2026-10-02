import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("join form share-code pattern escapes hyphen for HTML pattern/v flag", () => {
  const source = readFileSync("app/_components/JoinByCode.tsx", "utf8");

  assert.doesNotMatch(source, /\[A-Za-z0-9\\\\s-\]\{4,16\}/);
  assert.equal(
    source.includes("const SHARE_CODE_PATTERN = String.raw`[A-Za-z0-9\\s\\-]{4,16}`"),
    true,
  );
  assert.match(source, /pattern=\{SHARE_CODE_PATTERN\}/);
});

test("share-code readiness regex accepts valid examples and rejects invalid ones", () => {
  const shareCodeRegex = /^[A-Za-z0-9\s\-]{4,16}$/;
  const normalizeShareCodeInput = (value: string) => value.trim().replace(/\s+/g, " ");

  const validCodes = ["xwgyhn", "XWGYHN", "xwg-yhn", "xwg yhn"];
  for (const code of validCodes) {
    const normalized = normalizeShareCodeInput(code);
    assert.equal(shareCodeRegex.test(normalized), true, `expected valid: ${code}`);
  }

  const invalidCodes = ["abc", "abcdefghijklmnopq", "공유코드", "xwg@yhn", "xwg/yhn", "xwg_yhn", "xwg.yhn"];
  for (const code of invalidCodes) {
    const normalized = normalizeShareCodeInput(code);
    assert.equal(shareCodeRegex.test(normalized), false, `expected invalid: ${code}`);
  }
});

test("submitted share code is trimmed before route normalization", async () => {
  const { normalizeShareCode } = await import("@/lib/student/shareCode");
  const normalizeShareCodeInput = (value: string) => value.trim().replace(/\s+/g, " ");

  assert.equal(normalizeShareCode(normalizeShareCodeInput("   xwgyhn   ")), "xwgyhn");
});
