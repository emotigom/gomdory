import test from "node:test";
import assert from "node:assert/strict";
import { parseWebsiteStudioAiActionResult } from "@/lib/website-studio/websiteStudioAiParser";

test("reject non json", () => {
  assert.equal(parseWebsiteStudioAiActionResult("hello").ok, false);
});

test("parse fenced json", () => {
  const parsed = parseWebsiteStudioAiActionResult("```json\n{\"action\":\"noOp\"}\n```");
  assert.equal(parsed.ok, true);
});
