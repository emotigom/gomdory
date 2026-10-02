import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("review route exists", ()=>{
  assert.equal(fs.existsSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "page.tsx")), true);
});

test("review route does not import webllm runtime packages", ()=>{
  const source = fs.readFileSync(path.join(process.cwd(), "app", "dashboard", "websites", "[siteId]", "review", "WebsiteStudioReviewClient.tsx"), "utf8");
  const importLines = source.split("\n").filter((line)=>line.trimStart().startsWith("import "));
  assert.equal(importLines.some((line)=>/@mlc-ai\/web-llm|from\s+["']webllm["']/i.test(line)), false);
});
