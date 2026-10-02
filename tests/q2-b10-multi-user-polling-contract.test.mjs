import assert from "node:assert/strict";
import fs from "node:fs/promises";

const read = (file) => fs.readFile(new URL(`../${file}`, import.meta.url), "utf8");
const [fixture, ingress, middleware, spec, student] = await Promise.all([
  read("lib/q2/browser/multiUserPollingFixture.ts"),
  read("lib/q2/browser/studentEntryFixture.ts"),
  read("middleware.ts"),
  read("tests/browser/b10-multi-user-polling.spec.mjs"),
  read("app/s/[code]/_components/StudentBoardMinimal.tsx"),
]);
assert.match(fixture, /NODE_ENV !== "production"/);
assert.match(fixture, /stateVersion/);
assert.match(ingress, /headers\.delete\(Q2_B4_FIXTURE_TOKEN_HEADER\)/);
assert.match(ingress, /headers\.delete\(Q2_B4_FIXTURE_AUTHORIZATION_HEADER\)/);
const cardsRoute = await read("app/api/v1/share/[code]/walls/[wallId]/cards/route.ts");
assert.match(cardsRoute, /isQ2B10FixtureTarget\(code, wallId\)/);
assert.match(ingress, /normalizeShareCode\(code\) === Q2_B10_SHARE_CODE && wallId === Q2_B10_WALL_A_ID/);
assert.doesNotMatch(cardsRoute, /normalizeShareCode|getBoardByShareCode|isValidShareCode/);
assert.match(fixture, /multi-user-polling-v1/);
assert.match(middleware, /buildStudentEntryFixtureIngress/);
assert.match(spec, /browser\.newContext\(\)/);
assert.match(spec, /telemetry\.scenarios\.S1 = "PASS"/);
assert.match(spec, /telemetry\.scenarios\.S4 = "PASS"/);
assert.match(spec, /expectOwnedCardMenu/);
assert.match(student, /const \[clientId, setClientId\] = useState\(""\)/);
assert.match(student, /setClientId\(getOrCreateStudentDeviceId\(\)\)/);
assert.doesNotMatch(student, /useMemo\(\(\) => getOrCreateStudentDeviceId\(\), \[\]\)/);
console.log("Q2-B10 contract passed");
