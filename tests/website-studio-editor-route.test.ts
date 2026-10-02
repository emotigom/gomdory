import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("editor route exists", () => {
  const pagePath = path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "edit", "page.tsx");
  assert.equal(fs.existsSync(pagePath), true);
});

test("editor files do not import webllm runtime packages", () => {
  const files = [
    path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "edit", "WebsiteStudioEditorClient.tsx"),
    path.join(process.cwd(), "app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx"),
  ];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    const importLines = source.split("\n").filter((line) => line.trimStart().startsWith("import "));
    assert.equal(importLines.some((line) => /@mlc-ai\/web-llm|from\s+["']webllm["']/i.test(line)), false);
  }
});
