import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { PAGE_ROUTE_PATTERNS } from "@/lib/generated/pageRouteInventory";
import { getLessonTemplate } from "@/lib/lesson-activities/registry";
import { LESSON_03_04_VIBE_CODING_CONTENT } from "@/lib/edu/vibe-coding/lesson-03-04-content";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("A) lesson page is route-inventoried and includes core sections", () => {
  assert.ok(PAGE_ROUTE_PATTERNS.some((route) => route.patternPath === "/edu/vibe-coding/lesson-03-04"));

  const page = read("app", "edu", "vibe-coding", "lesson-03-04", "page.tsx");
  assert.match(page, /LESSON_03_04_VIBE_CODING_CONTENT/);

  for (const label of ["수업 목표", "성공 기준", "수업 전 리허설 체크리스트", "3차시", "4차시", "활동지", "대체 플랜", "리허설"]) {
    assert.match(page, new RegExp(label));
  }
});



test("A-1) preflight checklist content includes required keywords", () => {
  const checklistText = LESSON_03_04_VIBE_CODING_CONTENT.preflightChecklist
    .flatMap((group) => [group.title, ...group.items])
    .join("\n");
  for (const keyword of ["Gemini", "Lovable", "GKrry", "실패 기록"]) {
    assert.match(checklistText, new RegExp(keyword));
  }
});

test("A-2) lesson files remain content/UI only without db/api/schema wiring", () => {
  const page = read("app", "edu", "vibe-coding", "lesson-03-04", "page.tsx");
  const content = read("lib", "edu", "vibe-coding", "lesson-03-04-content.ts");
  assert.doesNotMatch(page, /createClient|supabase|fetch\(|\/api\//i);
  assert.doesNotMatch(content, /createClient|supabase|fetch\(|\/api\//i);
});

test("B) lesson registry maps lesson 03/04 to SSOT titles and keeps lesson 02 on web_coding_lite", () => {
  const lesson03 = getLessonTemplate("lesson_03_vibe_app_planning");
  const lesson04 = getLessonTemplate("lesson_04_vibe_app_prototype_share");
  const lesson02 = getLessonTemplate("lesson_02_ai_judgment_if_else");

  assert.ok(lesson03);
  assert.ok(lesson04);
  assert.ok(lesson02);

  assert.equal(lesson03?.title, LESSON_03_04_VIBE_CODING_CONTENT.lessonPlans[0]?.title);
  assert.equal(lesson04?.title, LESSON_03_04_VIBE_CODING_CONTENT.lessonPlans[1]?.title);

  assert.ok(lesson03?.activities.every((activity) => activity.activityType !== "web_coding_lite"));
  assert.ok(lesson04?.activities.every((activity) => activity.activityType !== "web_coding_lite"));
  assert.ok(lesson02?.activities.some((activity) => activity.activityType === "web_coding_lite"));
});

test("C) launchpad keeps lesson selector, start payload, and vibe panel links wired", () => {
  const launchpad = read("app", "dashboard", "classes", "[classId]", "launch", "LaunchpadClient.tsx");
  assert.match(launchpad, /3차시: Gemini로 AI 웹앱 기획과 프롬프트 설계/);
  assert.match(launchpad, /4차시: Lovable 프로토타입 제작과 제출/);
  assert.match(launchpad, /lessonTemplateId/);
  assert.match(launchpad, /바이브코딩 3\/4차시 도구/);
  assert.match(launchpad, /\/edu\/vibe-coding\/lesson-03-04/);
  assert.match(launchpad, /https:\/\/gemini\.google\.com\//);
  assert.match(launchpad, /https:\/\/lovable\.dev\//);
});

test("D) class session start API validates lessonTemplateId and persists lesson_template_id", () => {
  const route = read("app", "api", "v1", "classes", "[classId]", "sessions", "start", "route.ts");
  assert.match(route, /getLessonTemplate\(normalizedTemplateId\)/);
  assert.match(route, /invalid_lesson_template_id/);
  assert.match(route, /lesson_template_id/);
});

test("E) student live workspace routes lesson 03/04 to vibe guide, not web coding lite", () => {
  const panel = read("components", "lesson-activities", "StudentActivityPanel.tsx");
  assert.match(panel, /lesson_03_vibe_app_planning/);
  assert.match(panel, /lesson_04_vibe_app_prototype_share/);
  assert.match(panel, /보드 보기로 이동/);
  assert.match(panel, /Gemini 열기/);
  assert.match(panel, /Lovable 열기/);
  assert.match(panel, /<Link href="\/edu\/vibe-coding\/lesson-03-04" target="_blank" rel="noreferrer"/);
  assert.match(panel, /<a href="https:\/\/gemini\.google\.com\/" target="_blank" rel="noreferrer"/);
  assert.match(panel, /<a href="https:\/\/lovable\.dev\/" target="_blank" rel="noreferrer"/);
  assert.match(panel, /<button type="button" onClick=\{onOpenBoard\}/);
  assert.doesNotMatch(panel, /<a[^>]*>보드 보기로 이동<\/a>/);
  assert.doesNotMatch(panel, /<Link[^>]*>보드 보기로 이동<\/Link>/);
  assert.match(panel, /실명, 전화번호, 주소, 학교명, 얼굴 사진은 넣지 마세요/);

  assert.doesNotMatch(panel, /lesson_03_vibe_app_planning[\s\S]{0,220}WebCodingLiteActivity/);
  assert.doesNotMatch(panel, /lesson_04_vibe_app_prototype_share[\s\S]{0,220}WebCodingLiteActivity/);
});

test("F) student board threads lesson template -> mission banner -> compose lessonMode", () => {
  const board = read("app", "s", "[code]", "_components", "StudentBoardMinimal.tsx");
  assert.match(board, /activeLessonTemplateId/);
  assert.match(board, /getVibeCodingStudentMission\(activeLessonTemplateId\)/);
  assert.match(board, /VibeCodingMissionBanner/);
  assert.match(board, /lessonMode=\{lessonMode\}/);
});

test("G) compose panel retains vibe lesson mode, templates, text limit, and share card route", () => {
  const compose = read("app", "_components", "ComposeCardPanel.tsx");
  assert.match(compose, /lessonMode\?: "vibe_coding" \| null/);
  assert.match(compose, /바이브코딩 제출 도우미/);
  assert.match(compose, /VIBE_COMPOSE_TEMPLATES/);
  assert.match(compose, /MAX_STUDENT_TEXT_LENGTH\s*=\s*1000/);
  assert.match(compose, /routes\.api\.v1\("share", code, "walls", activeWallId, "cards"\)/);
});

test("H) teacher review panel keeps vibe submission filters and avoids publish\/showcase behavior", () => {
  const teacher = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardCanonicalClient.tsx");
  assert.match(teacher, /바이브코딩 제출물/);
  assert.match(teacher, /classifyVibeSubmission/);
  assert.match(teacher, /isVibeCodingLessonTemplateId/);

  for (const label of ["전체", "앱 아이디어", "AI 프롬프트", "작품 링크", "Canva 시안", "실패 기록", "친구 피드백", "링크 있음", "첨부 있음"]) {
    assert.match(teacher, new RegExp(label));
  }

  assert.doesNotMatch(teacher, /showcase/i);
  assert.doesNotMatch(teacher, /public\s*publish/i);
});
