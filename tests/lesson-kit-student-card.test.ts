import assert from "node:assert/strict";
import test from "node:test";

import { generateLessonKitStudentCardText } from "@/lib/curriculum/lessonKitStudentCard";

test("lesson 14 student card uses the public title while preserving download paths", () => {
  const card = generateLessonKitStudentCardText("lesson-14-ai-portfolio-starter");

  assert.ok(card);
  assert.match(card, /^\[오늘의 수업 자료\] AI 작품 갤러리 스타터 키트$/m);
  assert.doesNotMatch(card, /AI 포트폴리오 스타터/);
  assert.match(card, /\[ZIP 다운로드\] \/lesson-kits\/downloads\/lesson-14-ai-portfolio-starter\.zip/);
  assert.match(card, /index\.html: \/lesson-kits\/html\/lesson-14-ai-portfolio-starter\/index\.html/);
  assert.match(card, /Canva로 만든 여러 장짜리 그림 이야기는 picture-book\.html을 열기/);
  assert.match(card, /Canva로 만든 만화 카드나 직접 장면을 만들 때는 comic-board\.html을 열기/);
  assert.match(card, /picture-book\.html: \/lesson-kits\/html\/lesson-14-ai-portfolio-starter\/picture-book\.html/);
  assert.match(card, /\[저장 위치\] 내 컴퓨터의 lesson-14-ai-portfolio-starter 폴더에 저장하세요\./);
});

test("lesson 13 student card contains every required guidance section", () => {
  const card = generateLessonKitStudentCardText("lesson-13-ai-camera-card");

  assert.ok(card);
  assert.match(card, /^\[오늘의 수업 자료\] .+$/m);
  assert.match(card, /\[ZIP 다운로드\] \/lesson-kits\/downloads\/lesson-13-ai-photo-card-starter\.zip/);
  assert.match(card, /개별 파일\/코드 보기/);
  assert.match(card, /index\.html: \/lesson-kits\/html\/lesson-13-ai-photo-card-starter\/index\.html/);
  assert.match(card, /\[오늘 해야 할 일\]/);
  assert.match(card, /\[저장 위치\]/);

  const taskLines = card.split("\n").filter((line) => /^\d+\. /.test(line));
  assert.ok(taskLines.length >= 3 && taskLines.length <= 5);
});

test("student card generator returns undefined for unknown or unconfigured lessons", () => {
  assert.equal(generateLessonKitStudentCardText("unknown-lesson"), undefined);
  assert.equal(generateLessonKitStudentCardText("lesson-05-html-structure"), undefined);
});
