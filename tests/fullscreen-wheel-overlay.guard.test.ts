import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const TARGET_DIRS = [path.join("app", "_components"), path.join("app", "dashboard"), path.join("app", "s")];
const FILE_EXTENSIONS = new Set([".tsx", ".ts", ".jsx", ".js"]);
const FULLSCREEN_OVERLAY_RE = /\b(?:fixed|absolute)\s+inset-0\b/;
const POINTER_EVENTS_AUTO_RE = /\bpointer-events-auto\b/;
const ALLOW_MARKER = "data-allow-wheel-overlay";

const walkFiles = (dir: string): string[] => {
  const absDir = path.join(repoRoot, dir);
  if (!fs.existsSync(absDir)) {
    return [];
  }

  const files: string[] = [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const relPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkFiles(relPath));
      continue;
    }

    if (FILE_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(relPath);
    }
  }

  return files;
};

const lineNumberAt = (source: string, index: number) => source.slice(0, index).split("\n").length;

const hasAllowMarkerNearby = (source: string, startLine: number) => {
  const lines = source.split("\n");
  const from = Math.max(0, startLine - 12);
  const to = Math.min(lines.length, startLine + 12);
  for (let i = from; i < to; i += 1) {
    if (lines[i].includes(ALLOW_MARKER)) {
      return true;
    }
  }
  return false;
};

test("guard: fullscreen overlays cannot reintroduce wheel-stealer pointer events", () => {
  const violations: string[] = [];
  const files = TARGET_DIRS.flatMap((dir) => walkFiles(dir));

  for (const relPath of files) {
    const source = fs.readFileSync(path.join(repoRoot, relPath), "utf8");
    const jsxTagMatches = source.matchAll(/<[^>]{0,1200}>/g);

    for (const match of jsxTagMatches) {
      const chunk = match[0];
      if (!chunk.includes("className")) {
        continue;
      }
      if (!FULLSCREEN_OVERLAY_RE.test(chunk)) {
        continue;
      }
      if (!POINTER_EVENTS_AUTO_RE.test(chunk)) {
        continue;
      }

      const start = match.index ?? 0;
      const line = lineNumberAt(source, start);
      if (chunk.includes(ALLOW_MARKER) || hasAllowMarkerNearby(source, line)) {
        continue;
      }

      violations.push(`${relPath}:${line}`);
    }
  }

  assert.deepEqual(
    violations,
    [],
    [
      "Disallowed fullscreen interactive overlay pattern found.",
      "Do not combine `fixed|absolute inset-0` with `pointer-events-auto` on overlay shells.",
      `If truly required, add explicit allow marker: ${ALLOW_MARKER}.`,
      ...violations,
    ].join("\n"),
  );
});
