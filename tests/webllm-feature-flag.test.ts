import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("WebLLM lab page uses explicit helper-based flag checks", () => {
  const source = readFileSync(resolve(process.cwd(), "app/edu/ai-lab/page.tsx"), "utf8");
  assert.match(source, /isWebLLMLabEnabled/);
  assert.match(source, /비활성화/);
});
