import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(marketing)/pricing/page.tsx", "utf8");

test("pricing page route markers and semantic headings exist", () => {
  assert.match(source, /marketing-pricing-route-public/);
  assert.match(source, /<h1[^>]*>무료 수업부터, 필요한 만큼<\/h1>/);
  assert.match(source, /<h2[^>]*>한눈에 비교하기<\/h2>/);
});

test("pricing includes Free, Pro, School \/ Institution cards", () => {
  assert.match(source, /name: "Free"/);
  assert.match(source, /name: "Pro"/);
  assert.match(source, /name: "School \/ Institution"/);
});
