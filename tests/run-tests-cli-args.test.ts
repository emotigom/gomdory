import assert from "node:assert/strict";
import test from "node:test";

import { parseRunTestsArgs, splitTestMatchTokens } from "@/scripts/test-runner/cliArgs.mjs";

test("run-tests parses --match in both supported CLI forms", () => {
  assert.deepEqual(parseRunTestsArgs(["--match", "student,public"]).testMatch, "student,public");
  assert.deepEqual(parseRunTestsArgs(["--match=student,public"]).testMatch, "student,public");
});

test("run-tests parses --list without affecting match selection", () => {
  assert.deepEqual(parseRunTestsArgs(["--list", "--match", "student"]).listOnly, true);
  assert.deepEqual(parseRunTestsArgs(["--list", "--match", "student"]).testMatch, "student");
});

test("run-tests match token splitting trims whitespace and ignores empty values", () => {
  assert.deepEqual(splitTestMatchTokens(" student , , public-share "), ["student", "public-share"]);
  assert.deepEqual(splitTestMatchTokens(""), []);
  assert.deepEqual(splitTestMatchTokens(undefined), []);
});
