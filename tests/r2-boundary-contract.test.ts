import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const client = readFileSync(resolve(root, "lib/r2/client.ts"), "utf8");
const submission = readFileSync(resolve(root, "lib/student-apps/createStudentAppSubmission.ts"), "utf8");
const deployment = readFileSync(resolve(root, "lib/student-apps/storeStudentAppDeployment.ts"), "utf8");
assert.match(client, /R2_ACCOUNT_ID[\s\S]*R2_BUCKET[\s\S]*R2_ACCESS_KEY_ID[\s\S]*R2_SECRET_ACCESS_KEY/);
assert.match(client, /presignPutUrl/);
assert.match(submission, /buildStudentAppSubmissionPrefix[\s\S]*sha256/);
assert.match(deployment, /buildStudentAppDeploymentPrefix[\s\S]*sha256/);
