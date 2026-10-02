import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
const repoRoot = process.cwd();
const docsRoot = path.join(repoRoot, "docs");
const uppercaseKvPattern = /\b[A-Z][A-Z0-9_]*=/g;

const collectDocFiles = (dir: string): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectDocFiles(absolutePath));
      continue;
    }

    if (entry.isFile() && /\.mdx?$/i.test(entry.name)) {
      files.push(absolutePath);
    }
  }

  return files;
};

test("docs must not contain uppercase KEY=VALUE patterns", () => {
  const docFiles = collectDocFiles(docsRoot);
  const violations: string[] = [];

  for (const filePath of docFiles) {
    const relativePath = path.relative(repoRoot, filePath);
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const match of line.matchAll(uppercaseKvPattern)) {
        violations.push(`${relativePath}:${index + 1} -> ${match[0]}`);
      }
    });
  }

  if (violations.length > 0) {
    assert.fail([
      "Found forbidden uppercase KEY=VALUE pattern(s) in docs:",
      ...violations,
    ].join("\n"));
  }
});
