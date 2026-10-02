import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const review = fs.readFileSync("app/dashboard/websites/[siteId]/review/WebsiteStudioReviewClient.tsx", "utf8");
const publishApi = fs.readFileSync("app/api/website-studio/publish/route.ts", "utf8");

test("review uses Korean publish statuses and blocks publishing on blockers", () => {
  for (const label of ["공개 가능", "확인 후 공개 가능", "공개 불가", "통과", "확인 필요", "차단"]) {
    assert.match(review, new RegExp(`\\"${label}\\"`));
  }
  assert.match(review, /status === "blocked"/);
});

test("publish request/response shape includes classroom context and canonical ids", () => {
  for (const field of ["originBoardId", "originSource", "originDay"]) {
    assert.match(review, new RegExp(field));
    assert.match(publishApi, new RegExp(field));
  }
  assert.match(publishApi, /requestId/);
  assert.match(publishApi, /slug/);
  assert.match(publishApi, /publicUrl/);
  assert.match(publishApi, /publishId/);
  assert.ok(review.includes("json.publishId"));
});

test("publish flow excludes AI prompt/response persistence", () => {
  assert.doesNotMatch(publishApi, /\b(prompt|response)\s*[:=]/i);
});
