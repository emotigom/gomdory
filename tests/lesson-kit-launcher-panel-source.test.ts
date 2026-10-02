import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const panelSource = readFileSync(
  "app/dashboard/boards/[boardId]/board/_components/LessonKitLauncherPanel.tsx",
  "utf8",
);
const boardSource = readFileSync(
  "app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx",
  "utf8",
);

test("lesson kit launcher is mounted near the teacher student app area with the board access code", () => {
  assert.match(boardSource, /import LessonKitLauncherPanel/);
  assert.match(
    boardSource,
    /<StudentAppSourceInspector boardId=\{boardId\} classId=\{null\} wallId=\{null\} cardId=\{null\} boardAccessCode=\{boardAccessCode\} \/>\s*<LessonKitLauncherPanel boardId=\{boardId\} boardAccessCode=\{boardAccessCode\} \/>/,
  );
});

test("lesson kit launcher maps over registry entries and uses registry public URLs", () => {
  assert.match(panelSource, /HTML_LESSON_KIT_REGISTRY/);
  assert.match(panelSource, /lessonKits\.map/);
  assert.doesNotMatch(panelSource, /LESSON_KIT_ID/);
  assert.match(panelSource, /href=\{lessonKit\.public\.teacherHtmlUrl\}/);
  assert.match(panelSource, /href=\{lessonKit\.public\.sampleIndexUrl\}/);
  assert.doesNotMatch(panelSource, /docs\.(teacherHtmlPath|studentHtmlPath|sampleDirPath)/);
});

test("lesson kit launcher opens public lesson kit pages and student coding page in a new window", () => {
  const links = [...panelSource.matchAll(/<a[\s\S]*?<\/a>/g)].map((match) => match[0]);

  assert.equal(links.length, 4);
  for (const link of links) {
    assert.match(link, /target="_blank"/);
    assert.match(link, /rel="noopener noreferrer"/);
  }

  assert.match(panelSource, /수업 안내/);
  assert.match(panelSource, /예제 페이지/);
  assert.match(panelSource, /학생 코딩 열기/);
});

test("lesson kit launcher keeps the classroom CTA order and touch target size", () => {
  const studentCodingOpenIndex = panelSource.indexOf("학생 코딩 열기");
  const studentCodingCopyIndex = panelSource.indexOf("링크 복사");
  const teacherIndex = panelSource.indexOf("수업 안내");
  const sampleIndex = panelSource.lastIndexOf("예제 페이지");
  const studentCardCopyIndex = panelSource.indexOf("학생 안내 카드 복사");

  assert.equal(studentCodingOpenIndex > 0, true);
  assert.equal(studentCodingCopyIndex > studentCodingOpenIndex, true);
  assert.equal(teacherIndex > studentCodingCopyIndex, true);
  assert.equal(sampleIndex > teacherIndex, true);
  assert.equal(studentCardCopyIndex > sampleIndex, true);
  assert.equal(panelSource.includes("min-h-11"), true);
});

test("lesson kit launcher builds student coding URLs with explicit student app view and lessonKit query", () => {
  assert.match(panelSource, /boardId: string/);
  assert.match(panelSource, /boardAccessCode\?: string \| null/);
  assert.match(panelSource, /buildStudentCodingPath/);
  assert.match(panelSource, /`\/s\/\$\{encodeURIComponent\(code\)\}\?\$\{params\.toString\(\)\}`/);
  assert.match(panelSource, /new URLSearchParams\(\)/);
  assert.match(panelSource, /params\.set\("view", "student-app"\)/);
  assert.match(panelSource, /params\.set\("lessonKit", lessonKitId\)/);
  assert.match(panelSource, /const fallbackLessonKit = lessonKits\.at\(-1\) \?\? null/);
  assert.match(panelSource, /buildStudentCodingPath\(normalizedBoardAccessCode, fallbackLessonKit\.lessonId\)/);
  assert.match(panelSource, /buildStudentCodingPath\(normalizedBoardAccessCode, lessonKit\.lessonId\)/);
  assert.match(panelSource, /copyStudentCodingUrlForLesson\(lessonKit\.lessonId, lessonStudentCodingPath\)/);
  assert.match(panelSource, /href=\{studentCodingPath\}/);
  assert.match(panelSource, /new URL\(path, window\.location\.origin\)\.toString\(\)/);
  assert.doesNotMatch(panelSource, /https?:\/\/|gomdory\.com|gkrry\.com/i);
  assert.match(panelSource, /입장코드를 먼저 생성하면 학생 코딩 화면 링크를 사용할 수 있어요/);
});

test("lesson kit launcher auto opens the six hour submission window before student coding handoff", () => {
  assert.match(panelSource, /apiV1Path\("dashboard\/student-apps\/session"\)/);
  assert.match(panelSource, /action: "autoStart"/);
  assert.match(panelSource, /ensureSubmissionWindowOpen/);
  assert.match(panelSource, /학생 앱 제출을 6시간 동안 열어 두었어요/);
});

test("student coding open and copy links never render bare share-code URLs", () => {
  assert.doesNotMatch(panelSource, /buildStudentCodingPath\(normalizedBoardAccessCode\)/);
  assert.match(panelSource, /const ok = await copyText\(toSameOriginUrl\(studentCodingPath\)\)/);
  assert.match(panelSource, /기본값은 레지스트리의 마지막 수업 키트로 열립니다/);
});

test("lesson kit launcher distinguishes sample preview from real coding and submission", () => {
  assert.match(panelSource, /학생 코딩 열기/);
  assert.match(panelSource, /예제 페이지/);
  assert.match(panelSource, /제출\/공개 관리는 기존 학생 앱 제출 기능에서 진행해요/);
  assert.notEqual(panelSource.indexOf("예제 페이지"), panelSource.indexOf("학생 코딩 열기"));
});

test("lesson kit launcher keeps clipboard fallback guidance", () => {
  assert.match(panelSource, /navigator\.clipboard/);
  assert.match(panelSource, /typeof navigator === "undefined"/);
  assert.match(panelSource, /학생 코딩 화면 링크를 복사했어요/);
  assert.match(panelSource, /복사가 안 되면 학생 코딩 화면을 열어 주소를 직접 복사해 주세요/);
});

test("lesson kit launcher copies generated student card text with a selectable fallback", () => {
  assert.match(panelSource, /generateLessonKitStudentCardText\(lessonKit\.lessonId\)/);
  assert.match(panelSource, /copyStudentCardForLesson\(lessonKit\.lessonId, studentCardText\)/);
  assert.match(panelSource, /학생 안내 카드 복사/);
  assert.match(panelSource, /학생 안내 카드 문구를 복사했어요/);
  assert.match(panelSource, /studentCardCopyState === "manual" && studentCardText/);
  assert.match(panelSource, /<textarea/);
  assert.match(panelSource, /readOnly/);
  assert.match(panelSource, /value=\{studentCardText\}/);
  assert.match(panelSource, /event\.currentTarget\.select\(\)/);
  assert.doesNotMatch(panelSource, /create.*board.*card|insert.*card/i);
});

test("lesson kit launcher stays a thin client-side linker", () => {
  assert.doesNotMatch(panelSource, /gomdory\.com|gkrry\.com/i);
  assert.doesNotMatch(panelSource, /supabase|from\(|insert\(|update\(|createStudentAppSubmission|publish|r2Prefix|r2Key/i);
  assert.doesNotMatch(
    panelSource,
    /automatic injection|auto.?inject|template injection|sample.*inject|\bDB\b|\bdatabase\b|Cloudflare|WebLLM|Vite|Next\.js build/i,
  );
});
