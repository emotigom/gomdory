#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";

const repoRoot = process.cwd();

const allowlist = new Set([
  "lib/data/boards.ts",
  "scripts/check-board-id-contract.mjs",
]);

const ignoredDirs = new Set([
  ".git",
  ".next",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "out",
  ".turbo",
]);

const patterns = [
  { label: "board.board_id", regex: /board\.board_id\b/ },
  { label: "board.id ??", regex: /board\.id\s*\?\?/ },
  { label: "?? board.id", regex: /\?\?\s*board\.id/ },
  { label: "board.boardId ?? board.id", regex: /board\.boardId\s*\?\?\s*board\.id/ },
  { label: "board.id ?? board.boardId", regex: /board\.id\s*\?\?\s*board\.boardId/ },
];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function isAllowed(filePath) {
  const relative = toPosix(path.relative(repoRoot, filePath));
  return allowlist.has(relative);
}

async function listFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) continue;
      files.push(...(await listFiles(path.join(dir, entry.name))));
    } else if (entry.isFile()) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function shouldScanFile(filePath) {
  const ext = path.extname(filePath);
  return [".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"].includes(ext);
}

function collectMatches(content, filePath) {
  const matches = [];
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("/*") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("*/")
    ) {
      return;
    }
    patterns.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        matches.push({
          filePath,
          line: index + 1,
          label: pattern.label,
          text: line.trim(),
        });
      }
    });
  });
  return matches;
}

async function main() {
  const files = await listFiles(repoRoot);
  const violations = [];

  for (const filePath of files) {
    if (!shouldScanFile(filePath)) continue;
    if (isAllowed(filePath)) continue;

    const content = await fs.readFile(filePath, "utf8");
    violations.push(...collectMatches(content, filePath));
  }

  if (violations.length > 0) {
    console.error("[check:boardid] Board ID contract violations detected:");
    violations.forEach((violation) => {
      const relative = toPosix(path.relative(repoRoot, violation.filePath));
      console.error(
        `- ${relative}:${violation.line} (${violation.label}) ${violation.text}`,
      );
    });
    process.exit(1);
  }

  console.log("[check:boardid] OK - no contract violations found.");
}

main().catch((error) => {
  console.error("[check:boardid] Failed to run:", error);
  process.exit(1);
});
