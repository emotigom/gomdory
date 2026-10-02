import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const listRoute = readFileSync("app/api/v1/student-apps/gallery/list/route.ts", "utf8");
const detailRoute = readFileSync("app/api/v1/student-apps/gallery/detail/route.ts", "utf8");
const galleryPanel = readFileSync("app/s/[code]/_components/StudentAppGalleryPanel.tsx", "utf8");

test("gallery list exposes only published deployments for the current board", () => {
  assert.match(listRoute, /\.eq\("board_id", payload\.boardId\)/);
  assert.match(listRoute, /\.from\("student_app_deployments"\)/);
  assert.match(listRoute, /\.eq\("status", "published"\)/);
  assert.match(listRoute, /\.not\("published_at", "is", null\)/);
  assert.match(listRoute, /\.is\("deleted_at", null\)/);
  assert.match(listRoute, /\.limit\(MAX_GALLERY_APPS\)/);
  assert.doesNotMatch(listRoute, /\.in\("status"/);
  assert.doesNotMatch(listRoute, /\.eq\("status", "(needs_fix|archived|submitted|hidden|accepted|stored|approved)"\)/);
});

test("public gallery API stays separated from teacher review and private storage metadata", () => {
  assert.doesNotMatch(listRoute, /requireUserApi|submitted_by_name|student_note|teacher_note|contentText|contentBase64|r2_key|r2_prefix|public_url/);
  assert.match(listRoute, /displayUrl/);
  assert.match(listRoute, /authorLabel: "친구 작품"/);
  assert.match(detailRoute, /public_viewer_required/);
  assert.doesNotMatch(detailRoute, /student_app_submissions|student_app_submission_files|student_note|teacher_note|contentText|contentBase64|r2_key|r2_prefix/);

  for (const text of [
    "공개된 친구들의 앱 작품을 볼 수 있어요.",
    "안전 검사를 통과해 공개된 작품이 여기에 나타나요.",
    "아직 공개된 친구 작품이 없어요.",
    "연결이 잠시 불안정해요.",
    "다시 불러오기",
  ]) {
    assert.equal(galleryPanel.includes(text), true);
  }
  assert.match(galleryPanel, /target="_blank"/);
  assert.match(galleryPanel, /rel="noopener noreferrer"/);
  assert.doesNotMatch(galleryPanel, /apiV1Path\("student-apps\/gallery\/detail"\)|contentText|contentBase64|r2Prefix|r2Key|npm install|next build|vite build/i);
});
