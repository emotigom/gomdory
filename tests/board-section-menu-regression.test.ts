import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync("app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx", "utf8");

test("section menu trigger and actions are present", () => {
  assert.match(source, /<MoreMenu label="섹션 메뉴"/);
  assert.match(source, /이름 바꾸기/);
  assert.match(source, /삭제/);
  assert.doesNotMatch(source, /섹션 정보\s*<\/button>\s*<\/MoreMenu>/);
});

test("rename validation and delete confirmation messaging exist", () => {
  assert.match(source, /섹션 이름을 입력해주세요\./);
  assert.match(source, /카드가 있는 섹션은 먼저 카드를 이동하거나 삭제해야 합니다\./);
});
