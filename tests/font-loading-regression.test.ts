import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import test from "node:test";

const root = process.cwd();

const read = (...parts: string[]) => fs.readFileSync(path.join(root, ...parts), "utf8");

const trackedTextFiles = () =>
  execSync("git ls-files app", { encoding: "utf8" })
    .split("\n")
    .filter(Boolean)
    .filter((file) => /\.(ts|tsx|js|mjs|cjs|css|md|html|json)$/i.test(file));

test("repository has no invalid SUIT Google Fonts css2 request", () => {
  const forbidden = /fonts\.googleapis\.com\/css2\?family=[^"'\s]*SUIT/i;

  for (const file of trackedTextFiles()) {
    const content = read(file);
    assert.doesNotMatch(content, forbidden, `Forbidden Google Fonts SUIT reference found in ${file}`);
  }
});

test("global typography keeps SUIT sans stack via --font-sans without Google Fonts", () => {
  const globals = read("app", "globals.css");
  assert.match(globals, /--font-sans:\s*"SUIT",\s*"Apple SD Gothic Neo",\s*"Noto Sans KR",\s*system-ui,\s*-apple-system,\s*BlinkMacSystemFont,\s*"Segoe UI",\s*sans-serif;/);
  assert.match(globals, /html,\s*\nbody\s*\{[\s\S]*font-family:\s*var\(--dashboard-font-family,\s*var\(--font-sans\)\);/);
  assert.doesNotMatch(globals, new RegExp(["fonts\\.googleapis\\.com/css2\\?family=", "SUIT"].join(""), "i"));
});

test("root and marketing layouts do not inject Google Fonts SUIT stylesheets", () => {
  const rootLayout = read("app", "layout.tsx");
  const marketingLayout = read("app", "(marketing)", "layout.tsx");

  assert.doesNotMatch(rootLayout, new RegExp(["fonts\\.googleapis\\.com/css2\\?family=", "SUIT"].join(""), "i"));
  assert.doesNotMatch(marketingLayout, new RegExp(["fonts\\.googleapis\\.com/css2\\?family=", "SUIT"].join(""), "i"));
});
