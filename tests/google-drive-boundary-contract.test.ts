import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const identity = readFileSync(resolve(root, "lib/google-drive/googleIdentity.ts"), "utf8");
const preferences = readFileSync(resolve(root, "app/api/v1/google-drive/preferences/route.ts"), "utf8");
const upload = readFileSync(resolve(root, "lib/google-drive/driveUpload.ts"), "utf8");
assert.match(identity, /let accessToken: string \| null/);
assert.doesNotMatch(identity, /localStorage|sessionStorage|document\.cookie/);
assert.match(preferences, /"student-records"[\s\S]*"student-gallery"[\s\S]*"board-backup"/);
assert.doesNotMatch(preferences, /accessToken|refreshToken/);
assert.match(upload, /https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files/);
