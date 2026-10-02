import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const starterPath = path.join(process.cwd(), "app", "dashboard", "websites", "new", "WebsiteStudioStarterClient.tsx");

test("starter reads board context query params and renders education bridge copy", () => {
  const source = fs.readFileSync(starterPath, "utf8");
  assert.match(source, /searchParams\.get\("boardId"\)/);
  assert.match(source, /searchParams\.get\("source"\)/);
  assert.match(source, /searchParams\.get\("day"\)/);
  assert.match(source, /AI 수업 코스에서 연결되었습니다\./);
  assert.match(source, /템플릿을 선택하면 이 보드와 연결된 로컬 초안이 만들어집니다\./);
});

test("template selection still navigates to local editor route", () => {
  const source = fs.readFileSync(starterPath, "utf8");
  assert.match(source, /router\.push\(`\/dashboard\/websites\/\$\{draft\.id\}\/edit`\)/);
});

test("localStorage-dependent draft cards stay gated until client mount", () => {
  const source = fs.readFileSync(starterPath, "utf8");
  assert.match(source, /useEffect\(\(\) => \{/);
  assert.match(source, /setMounted\(true\)/);
  assert.match(source, /setDrafts\(listLocalWebsiteProjects\(\)\)/);
  assert.match(source, /!mounted \? \(/);
});

test("starter hub does not import webllm runtime packages", () => {
  const source = fs.readFileSync(starterPath, "utf8");
  assert.doesNotMatch(source, /@mlc-ai\/web-llm|webllm|WebsiteStudioWebLLMAssistantClient/);
});
