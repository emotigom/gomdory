#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts/guard/no-hardcoded.baseline.json");
const EXCEPTIONS_PATH = path.join(ROOT, "scripts/guard/no-hardcoded-exceptions.json");
const ALLOW_COMMENT = "hardcoded-allow";

const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs"]);
const TARGET_ROOTS = ["app", "lib", "components", "scripts", "worker", "middleware.ts", "custom-worker.ts"];
const IGNORE_DIRS = new Set(["node_modules", ".git", ".next", ".open-next", "docs", "public", "supabase", "vendor", "tests"]);

const PATTERNS = [
  { id: "domain-gkrry", regex: /https?:\/\/(?:www\.)?gkrry\.com/ },
  { id: "domain-gomdory", regex: /https?:\/\/(?:www\.)?gomdory\.com/ },
  { id: "models-base", regex: /https?:\/\/models\.gomdory\.com/ },
  { id: "r2-base", regex: /https?:\/\/[a-z0-9-]+\.r2\.cloudflarestorage\.com/ },
];

const loadJson = (filePath, fallback) => {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
};

const parseBaselineSignature = (entry) => {
  const match = String(entry).match(/^(.+):\d+:([a-z0-9-]+)$/);
  return match ? match[1] + ":" + match[2] : null;
};

const createBaselineAllowance = (entries) => {
  const counts = new Map();
  for (const entry of entries) {
    const signature = parseBaselineSignature(entry);
    if (!signature) continue;
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return (file, patternId) => {
    const signature = file + ":" + patternId;
    const remaining = counts.get(signature) ?? 0;
    if (remaining <= 0) return false;
    counts.set(signature, remaining - 1);
    return true;
  };
};

const baselineAllows = createBaselineAllowance(loadJson(BASELINE_PATH, []));
const exceptions = loadJson(EXCEPTIONS_PATH, { files: {}, patterns: {} });
const exceptionFiles = new Set(Object.keys(exceptions.files ?? {}));
const exceptionPatterns = new Set(Object.keys(exceptions.patterns ?? {}));

const collectFiles = (entryPath) => {
  const abs = path.join(ROOT, entryPath);
  if (!existsSync(abs)) return [];
  const st = statSync(abs);
  if (!st.isDirectory()) return [entryPath];

  const out = [];
  const walk = (dir) => {
    for (const item of readdirSync(dir)) {
      const fullPath = path.join(dir, item);
      const relPath = path.relative(ROOT, fullPath);
      const itemStat = statSync(fullPath);
      if (itemStat.isDirectory()) {
        if (IGNORE_DIRS.has(item)) continue;
        walk(fullPath);
        continue;
      }
      const ext = path.extname(item);
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      out.push(relPath);
    }
  };

  walk(abs);
  return out;
};

if (process.argv.includes("--self-test")) {
  const allows = createBaselineAllowance([
    "app/example.ts:10:domain-gomdory",
    "app/example.ts:20:domain-gomdory",
    "app/example.ts:30:domain-gkrry",
  ]);
  const checks = [
    allows("app/example.ts", "domain-gomdory") === true,
    allows("app/example.ts", "domain-gomdory") === true,
    allows("app/example.ts", "domain-gomdory") === false,
    allows("app/example.ts", "domain-gkrry") === true,
    allows("app/example.ts", "domain-gkrry") === false,
    allows("app/other.ts", "domain-gomdory") === false,
  ];
  if (checks.some((value) => !value)) {
    console.error("[check:no-hardcoded] baseline allowance self-test FAIL");
    process.exit(1);
  }
  console.log("[check:no-hardcoded] baseline allowance self-test PASS");
  process.exit(0);
}

const targetFiles = Array.from(new Set(TARGET_ROOTS.flatMap((entry) => collectFiles(entry))));
const violations = [];

for (const file of targetFiles) {
  if (exceptionFiles.has(file)) continue;
  const source = readFileSync(path.join(ROOT, file), "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    if (line.includes(ALLOW_COMMENT)) return;
    for (const pattern of PATTERNS) {
      if (exceptionPatterns.has(pattern.id)) continue;
      if (!pattern.regex.test(line)) continue;

      const violationId = `${file}:${index + 1}:${pattern.id}`;
      if (baselineAllows(file, pattern.id)) continue;
      violations.push(`${violationId} (hardcoded element detected)`);
    }
  });
}

if (violations.length) {
  console.error("[check:no-hardcoded] FAIL");
  violations.forEach((violation) => console.error(` - ${violation}`));
  console.error("Use env/config constants. Exceptions are limited to scripts/guard/no-hardcoded-exceptions.json or // hardcoded-allow comments.");
  process.exit(1);
}

console.log("[check:no-hardcoded] OK");
