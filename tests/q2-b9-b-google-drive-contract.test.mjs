import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const identity = read("lib/google-drive/googleIdentity.ts");
const route = read("app/api/v1/google-drive/preferences/route.ts");
const fixture = read("lib/q2/browser/googleDriveIntegrationFixture.ts");

assert.match(identity, /let accessToken: string \| null/);
assert.doesNotMatch(identity, /localStorage|sessionStorage|document\.cookie/);
assert.match(route, /isQ2B9FixtureAuthorized/);
assert.match(route, /fixturePurposeOnly/);
assert.match(fixture, /purpose: "board-backup"/);
