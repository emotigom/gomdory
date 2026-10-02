import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const read = (...parts: string[]) => fs.readFileSync(path.join(process.cwd(), ...parts), "utf8");

test("class tab renders practice inbox button behind ON feature flag", () => {
  const source = read("app", "dashboard", "boards", "[boardId]", "board", "TeacherBoardMinimalClient.tsx");

  assert.match(source, /NEXT_PUBLIC_ENABLE_EDU_PRACTICE_SUBMISSIONS === "1"/);
  assert.match(source, /\{PRACTICE_SUBMISSION_ENABLED \? "ON" : "OFF"\}/);
  assert.match(source, /\{PRACTICE_SUBMISSION_ENABLED \? \(/);
  assert.match(source, />\s*제출함 열기\s*</);
});
