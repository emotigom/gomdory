import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("world-hub route metadata and loading copy are Korean", () => {
  const pageSource = fs.readFileSync(path.join(process.cwd(), "app", "world-hub", "page.tsx"), "utf8");
  const loadingSource = fs.readFileSync(path.join(process.cwd(), "app", "world-hub", "loading.tsx"), "utf8");

  assert.ok(pageSource.includes("숲속 모험 베이스캠프"));
  assert.ok(loadingSource.includes("월드 허브 공간을 차분히 준비하고 있어요"));
});

test("default manifest exposes Korean movement and interaction labels", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib", "world-hub", "config", "defaultManifest.ts"), "utf8");

  assert.ok(source.includes("WASD 또는 방향키로 이동"));
  assert.ok(source.includes("홈 · 광장 모닥불 · 아카데미 롯지 · 길잡이 근처에서 E 키"));
  assert.ok(source.includes("숲속 모험 베이스캠프"));
  assert.ok(!source.includes("WASD / Arrow keys to wander"));
});

test("world hub manifest uses Korean zone terminology", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib", "world-hub", "config", "defaultManifest.ts"), "utf8");

  assert.ok(source.includes("홈 길"));
  assert.ok(source.includes("아카데미 진입"));
  assert.ok(source.includes("포털 언덕"));
});
