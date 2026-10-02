import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

test("Q2-B9-D fixture is non-production, single-use, and binding-aware", () => {
  const fixture = read("lib/q2/browser/turnstileIntegrationFixture.ts");
  const ingress = read("lib/q2/browser/studentEntryFixture.ts");
  assert.match(fixture, /challenge\.usedAt/);
  assert.match(fixture, /challenge\.hostname !== input\.hostname/);
  assert.match(fixture, /challenge\.action !== input\.action/);
  assert.match(fixture, /challenge\.cdata !== input\.cdata/);
  assert.match(ingress, /Q2_B9_D_FIXTURE_MODE/);
  assert.match(ingress, /NODE_ENV !== "production"/);
});

test("Q2-B9-D preserves the product card route and production binding checks", () => {
  const route = read("app/api/v1/share/[code]/walls/[wallId]/cards/route.ts");
  const fixture = read("lib/q2/browser/studentEntryFixture.ts");
  const verifier = read("lib/turnstile.ts");
  assert.doesNotMatch(route, /normalizeShareCode|getBoardByShareCode|isValidShareCode/);
  assert.match(route, /isQ2B9DTurnstileFixtureTarget\(code, wallId\)/);
  assert.match(fixture, /normalizeShareCode\(code\) === Q2_B9_D_VALID_CODE && wallId === Q2_B9_D_WALL_ID/);
  assert.match(route, /verifyTurnstileTokenWithTelemetry/);
  assert.match(route, /expectedAction: "share_card_create"/);
  assert.match(route, /expectedCdata: "share-card-create"/);
  assert.match(verifier, /data\.hostname !== expected\.hostname/);
  assert.match(verifier, /data\.action !== expected\.action/);
  assert.match(verifier, /data\.cdata !== expected\.cdata/);
});
