import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const HANGUL_REGEX = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF]/;
const PLACEHOLDER_REGEX = /\b(?:todo|tbd|lorem|sample|test)\b/i;
const ROBOTIC_PLACEHOLDER_REGEX = /(?:placeholder|임시 문구|추후 작성|나중에 작성|예시 문구)/i;

function assertRequiredKoreanText(value: unknown, label: string) {
  assert.equal(typeof value, "string", `${label} must be a string`);
  const trimmed = value.trim();
  assert.ok(trimmed.length >= 6, `${label} must be meaningful text`);
  assert.ok(HANGUL_REGEX.test(trimmed), `${label} must include Hangul`);
  assert.ok(!PLACEHOLDER_REGEX.test(trimmed), `${label} must not include placeholder tokens`);
  assert.ok(!ROBOTIC_PLACEHOLDER_REGEX.test(trimmed), `${label} must not include robotic placeholder phrasing`);
}

test("coding studio surface keeps guided Korean-first copy", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "edu", "coding", "_components", "CodingStudioClient.tsx"), "utf8");
  assert.ok(source.includes("여기는 아카데미 준비를 3D 실행과 수정으로 이어가는 단계형 코딩 스튜디오예요."));
  assert.ok(source.includes("조용한 체크포인트"));
  assert.ok(source.includes("오늘의 실습 경로"));
  assert.ok(source.includes("현재 레슨"));
  assert.ok(source.includes("아카데미/월드 허브로"));
  assert.ok(source.includes("아카데미에서 정리한 생각을, 3D 실행·관찰·수정 루프로 완성해요."));
});

test("review sheet keeps pedagogical Korean-first copy", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "edu", "coding", "review", "page.tsx"), "utf8");
  const requiredLines = [
    { label: "evidence heading", text: "학습 근거(Evidence)" },
    { label: "revision focus", text: "다음 수정 초점" },
    { label: "feedback guidance", text: "짧고 선명한 메모 1~3개" },
    { label: "teacher purpose", text: "교사용 목적" },
  ] as const;

  for (const entry of requiredLines) {
    assertRequiredKoreanText(entry.text, entry.label);
    assert.ok(source.includes(entry.text), `${entry.label} must remain in review sheet`);
  }

  assert.ok(source.includes("다음 수정 방향"), "student-facing guidance should remain instructional");
});


test("canonical lesson ids remain intact", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "lib", "coding-studio", "lessons.ts"), "utf8");
  for (const lessonId of ["goal-move", "turn-pivot", "repeat-route", "sensor-branch", "strategy-tune", "next-preview"]) {
    assert.ok(source.includes(`id: "${lessonId}"`));
  }
});
