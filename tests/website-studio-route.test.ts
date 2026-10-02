import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("website studio canonical route exists", () => {
  const pagePath = path.join(process.cwd(), "app", "dashboard", "websites", "new", "page.tsx");
  assert.equal(fs.existsSync(pagePath), true);
});

test("starter shell does not import webllm runtime packages", () => {
  const clientPath = path.join(process.cwd(), "app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx");
  const source = fs.readFileSync(clientPath, "utf8");
  const importLines = source
    .split("\n")
    .filter((line) => line.trimStart().startsWith("import "));
  assert.equal(importLines.some((line) => /@mlc-ai\/web-llm|from\s+["']webllm["']/i.test(line)), false);
});
