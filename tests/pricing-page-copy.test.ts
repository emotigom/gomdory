import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(marketing)/pricing/page.tsx", "utf8");

test("pricing copy is decision-oriented and honest about Pro readiness", () => {
  assert.match(source, /무료 수업부터, 필요한 만큼/);
  assert.match(source, /Pro 준비 중 \/ 문의 가능/);
  assert.match(source, /Free는 바로 시작할 수 있습니다/);
  assert.match(source, /Pro와 기관 플랜은 문의 후 진행됩니다/);
});

test("pricing copy avoids institution typo", () => {
  assert.doesNotMatch(source, /Insitution/);
});
