import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const uiSource = readFileSync("app/dashboard/boards/[boardId]/board/_components/StudentAppSourceInspector.tsx", "utf8");
const boardSource = readFileSync("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx", "utf8");
const previewHelperSource = readFileSync("app/dashboard/boards/[boardId]/board/_components/studentAppLocalPreview.ts", "utf8");

test("teacher inspector explains Level 1 static deploy contract", () => {
  for (const text of [
    "학생 제출 앱 검토",
    "현재는 HTML/CSS/JS 정적 웹앱만 검토합니다.",
    "React/Vite/Next.js 자동 빌드는 아직 지원하지 않습니다.",
    "서버 실행/API/Next.js SSR도 지원하지 않아요",
    "index.html, style.css, script.js",
    "package.json 자동 설치나 빌드는 하지 않습니다",
    "ZIP 정적 사이트 가져오기",
    "my-app/index.html처럼 단일 폴더 안에 들어 있어도 괜찮습니다",
    "샘플 구조: index.html, style.css, script.js, images/logo.png, assets/data.json",
    "ZIP 파일 자체는 저장하지 않습니다",
    "프로젝트 소스로 보입니다",
    "저장은 R2와 Supabase에 정적 파일 manifest를 기록하는 단계입니다",
    "저장만으로 학생에게 공개되지 않습니다",
    "갤러리에 공개는 저장된 HTML/CSS/JS 정적 웹앱만 가능합니다",
    "교사가 확인한 HTML/CSS/JS 정적 웹앱을 갤러리에 공개합니다",
    "친구 작품 공개는 저장된 앱에서 별도로 설정합니다",
    "최신 제출물만 승인할 수 있어요",
    "수정 필요",
    "공개 해제",
    "공유 링크 열기",
  ]) {
    assert.equal(uiSource.includes(text), true);
  }
  assert.match(boardSource, /<StudentAppSourceInspector boardId=\{boardId\}/);
});

test("teacher inspector keeps sandbox and API boundaries", () => {
  assert.match(uiSource, /sandbox="allow-scripts"/);
  const sandboxAttrs = [...uiSource.matchAll(/sandbox="([^"]*)"/g)].map((match) => match[1]);
  assert.ok(sandboxAttrs.length >= 1);
  assert.ok(sandboxAttrs.every((attr) => attr === "allow-scripts"));
  assert.match(uiSource, /apiV1Path\("dashboard\/student-apps\/validate"\)/);
  assert.match(uiSource, /apiV1Path\("dashboard\/student-apps\/store"\)/);
  assert.match(uiSource, /apiV1Path\("dashboard\/student-apps\/publish"\)/);
  assert.match(uiSource, /apiV1Path\("dashboard\/student-apps\/list"\)/);
  assert.match(uiSource, /apiV1Path\("dashboard\/student-apps\/submissions\/list"\)/);
  assert.match(uiSource, /apiV1Path\("dashboard\/student-apps\/submissions\/review"\)/);
  assert.doesNotMatch(uiSource, /router\.refresh|jszip|adm-zip|yauzl|npm install|next build|vite build/i);
  assert.doesNotMatch(uiSource, /r2Prefix|r2Key|submissions\/private\//);
  assert.doesNotMatch(previewHelperSource, /allow-same-origin/);
});

test("teacher submission review inbox distinguishes accepted reviews from published deployments", () => {
  for (const text of ["검토 대기", "수정 요청", "승인됨", "보관됨", "전체"]) {
    assert.equal(uiSource.includes(text), true);
  }
  assert.match(uiSource, /status === "accepted" \? "승인됨"/);
  assert.doesNotMatch(uiSource, /status === "accepted" \? "(?:갤러리 )?공개됨"/);
  assert.match(uiSource, /status === "published" \? "공개 중"/);
  assert.match(uiSource, /승인됨은 교사가 검토를 마친 상태입니다/);
  assert.match(uiSource, /친구 작품 공개.*별도/);
  assert.match(uiSource, /useState<SubmissionReviewTab>\("pending"\)/);
  assert.match(uiSource, /item\.status === "submitted" && item\.isLatest === true/);
  assert.match(uiSource, /tab\.key === "accepted" \? submissionSummary\.accepted/);
  assert.match(uiSource, /submissions\.filter\(\(item\) => item\.status === "accepted"\)/);
  assert.match(uiSource, /previousSubmissions/);
  assert.match(uiSource, /expandedPreviousSubmissionIds/);
  assert.match(uiSource, /visibleSubmissions\.map/);
  assert.match(uiSource, /line-clamp-2/);
  assert.doesNotMatch(uiSource, /authorClientId|author_client_id|submitted_by_user_id/);
});
