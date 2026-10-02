import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/auth/login/_components/StatusHudPanel.tsx", "utf8");

test("login status keeps provider and incident details out of the public panel", () => {
  assert.match(source, /publicServiceLabel/);
  assert.match(source, /statusLabel\(service\.level\)/);
  assert.match(source, /로그인 준비가 완료되었습니다/);
  assert.doesNotMatch(source, /externalServices|incident\.title|service\.message/);
});

test("login status shows each user-facing connection once", () => {
  assert.doesNotMatch(source, /snapshot\?\.telemetry|publicTelemetry|publicMetricLabel/);
  assert.match(source, /수업 데이터/);
  assert.match(source, /보드 연결/);
});
