import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("/edu/ai-lab uses dedicated EDU shell copy", () => {
  const source = readFileSync(resolve(process.cwd(), "app/edu/_components/EduHeader.tsx"), "utf8");

  assert.match(source, /isWebLLMLabRoute/);
  assert.match(source, /headerTitle = isWebLLMLabRoute \? "WebLLM Lab 진단"/);
  assert.match(source, /headerTitle = isWebLLMLabRoute \? "WebLLM Lab 진단" : "AI 웹사이트 스튜디오"/);
});
