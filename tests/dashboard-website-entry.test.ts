import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

test("dashboard has website create entry pointing to canonical route", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "CreateBoardSection.tsx");
  const source = fs.readFileSync(filePath, "utf8");
  assert.equal(source.includes("웹사이트 만들기"), true);
  assert.equal(source.includes('href="/dashboard/websites/new"'), true);
  assert.match(source, /<Link\b[^>]*href="\/dashboard\/websites\/new"[^>]*>\s*웹사이트 열기\s*<\/Link>/);
});
