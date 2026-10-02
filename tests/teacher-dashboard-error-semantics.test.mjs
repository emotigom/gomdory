import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");
const error = read("app/dashboard/error.tsx");
const loading = read("app/dashboard/loading.tsx");
const empty = read("app/dashboard/_components/EmptyDashboardState.tsx");

test("dashboard error has one labelled alert and does not expose boundary internals", () => {
  assert.match(error, /role="alert"/);
  assert.match(error, /aria-labelledby="teacher-dashboard-error-title"/);
  assert.match(error, /aria-describedby="teacher-dashboard-error-description"/);
  assert.match(error, /<h1 id="teacher-dashboard-error-title"/);
  assert.match(error, /<p id="teacher-dashboard-error-description"/);
  assert.equal((error.match(/role="alert"/g) ?? []).length, 1);
  assert.doesNotMatch(error, /<code[^>]*>\{error\.digest\}/);
  assert.doesNotMatch(error, /오류 코드/);
});

test("dashboard retry is a native button with a synchronous duplicate guard", () => {
  assert.match(error, /const retryGuard = useRef\(false\)/);
  assert.match(error, /if \(retryGuard\.current\) return/);
  assert.match(error, /retryGuard\.current = true/);
  assert.match(error, /type="button"/);
  assert.match(error, /onClick=\{retry\}/);
  assert.match(error, /reset\(\)/);
});

test("loading is one named status while skeletons stay hidden and empty remains normal", () => {
  assert.equal((loading.match(/role="status"/g) ?? []).length, 1);
  assert.match(loading, /대시보드를 불러오는 중입니다/);
  assert.match(loading, /aria-hidden/);
  assert.match(empty, /data-empty-dashboard/);
  assert.match(empty, /<h2/);
  assert.doesNotMatch(empty, /role="alert"/);
});
