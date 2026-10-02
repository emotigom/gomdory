import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("public share route exists", () => {
  assert.equal(fs.existsSync(path.join(process.cwd(), "app", "w", "[slug]", "page.tsx")), true);
});

test("public route does not import webllm runtime", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "app", "w", "[slug]", "page.tsx"), "utf8");
  assert.equal(/@mlc-ai\/web-llm|from\s+["']webllm["']/i.test(source), false);
});
