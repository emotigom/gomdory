import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const teacherClient = fs.readFileSync("app/edu/lesson/teacher/CoursewareTeacherDashboardClient.tsx", "utf8");
const starterClient = fs.readFileSync("app/dashboard/websites/new/WebsiteStudioStarterClient.tsx", "utf8");
const reviewClient = fs.readFileSync("app/dashboard/websites/[siteId]/review/WebsiteStudioReviewClient.tsx", "utf8");
const publicRoute = fs.readFileSync("app/w/[slug]/page.tsx", "utf8");
const showcasePage = fs.readFileSync("app/edu/lesson/teacher/showcase/page.tsx", "utf8");
const showcaseClient = fs.readFileSync("app/edu/lesson/teacher/showcase/ShowcaseClient.tsx", "utf8");

test("teacher CTA and starter route keep boardId/source classroom wiring", () => {
  assert.match(teacherClient, /\/dashboard\/websites\/new\?boardId=\$\{encodeURIComponent\(boardId\)\}&source=edu-course/);
  assert.match(starterClient, /searchParams\.get\("boardId"\)/);
  assert.match(starterClient, /searchParams\.get\("source"\)/);
});

test("review handoff and publish success expose board submission + teacher gallery link", () => {
  assert.match(reviewClient, /hasBoardHandoff = Boolean\(project\.originBoardId\)/);
  assert.match(reviewClient, /공개하면 이 웹사이트가 수업 보드 작품 목록에 표시됩니다\./);
  assert.match(reviewClient, /수업 보드 작품 목록에 제출되었습니다\./);
  assert.match(reviewClient, /선생님 작품 목록으로 이동할 수 있습니다\./);
  assert.match(reviewClient, /선생님 작품 목록으로 이동/);
});

test("teacher gallery and showcase expose classroom moderation affordances", () => {
  assert.match(teacherClient, /QR 보기/);
  assert.match(teacherClient, /발표\/전시 모드 열기/);
  assert.match(teacherClient, /공개 중지/);
  assert.match(showcasePage, /getPublishedWebsiteStudioSitesForBoard/);
  assert.match(showcaseClient, /아직 공개된 학생 웹사이트가 없습니다\./);
});

test("public route safely handles unpublished state", () => {
  assert.match(publicRoute, /published\.status !== "published"/);
  assert.match(publicRoute, /notFound\(\)/);
});

test("gallery/showcase/review/public do not import webllm runtime", () => {
  const surface = `${teacherClient}\n${showcaseClient}\n${reviewClient}\n${publicRoute}`;
  assert.doesNotMatch(surface, /@mlc-ai\/web-llm/);
});

test("classroom surfaces keep metadata-only privacy boundaries", () => {
  const gallerySurface = `${teacherClient}\n${showcaseClient}`;
  assert.doesNotMatch(gallerySurface, /owner email|owner_email|student email|student_email/i);
  assert.doesNotMatch(gallerySurface, /"prompt"|"response"|prompt_text|response_text|assistant_prompt|assistant_response/i);
  assert.doesNotMatch(gallerySurface, /fullDocument|full_document|raw snapshot payload/i);
  assert.match(reviewClient, /수업 보드 작품 목록에 제출되었습니다\./);
});

test("core classroom flow remains usable without webllm flags", () => {
  const coreFlowSurface = `${starterClient}\n${reviewClient}\n${teacherClient}\n${showcaseClient}`;
  assert.doesNotMatch(coreFlowSurface, /NEXT_PUBLIC_WEBSITE_STUDIO_AI_ASSISTANT_V1/);
  assert.doesNotMatch(coreFlowSurface, /NEXT_PUBLIC_WEBLLM_GOMDORY_MODELS_V1/);
});
