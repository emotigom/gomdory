import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const reviewClient = fs.readFileSync("app/dashboard/websites/[siteId]/review/WebsiteStudioReviewClient.tsx", "utf8");

test("publish success with board context includes teacher page link + submission copy", () => {
  assert.match(reviewClient, /수업 보드 작품 목록에 제출되었습니다\./);
  assert.match(reviewClient, /선생님 작품 목록으로 이동/);
  assert.match(reviewClient, /\/edu\/lesson\/teacher\?boardId=\$\{encodeURIComponent\(project\.originBoardId\)\}/);
});

test("review page shows board handoff and day activity copy only under metadata conditions", () => {
  assert.match(reviewClient, /hasBoardHandoff \? <p className="mt-2 text-xs text-indigo-700">공개하면 이 웹사이트가 수업 보드 작품 목록에 표시됩니다\.<\/p> : null/);
  assert.match(reviewClient, /project\.originDay \? <p className="text-xs text-slate-600">Day \{project\.originDay\} 활동 작품으로 표시됩니다\.<\/p> : null/);
  assert.match(reviewClient, /hasBoardHandoff = Boolean\(project\.originBoardId\)/);
});

test("publish success without board context does not show board handoff ui path", () => {
  assert.match(reviewClient, /publishResult && hasBoardHandoff \? <div/);
});
