#!/usr/bin/env node
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, "scripts/guard/api-key-violations.baseline.json");
const EXCEPTIONS_PATH = path.join(ROOT, "scripts/guard/api-key-exceptions.json");
const ALLOW_SNAKE_COMMENT = "api-key-allow-snake-case";
const ALLOW_MIXED_COMMENT = "api-key-allow-mixed";

const normalize = (value) => value.replace(/[_-]/g, "").toLowerCase();
const isSnakeCase = (key) => /^[a-z][a-z0-9]*(_[a-z0-9]+)+$/.test(key);
const isLikelyFieldKey = (key) => /^[a-zA-Z][a-zA-Z0-9_]*$/.test(key) && key.length > 1;

const loadJson = (filePath, fallback) => {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(readFileSync(filePath, "utf8"));
};

const parseBaselineSignature = (entry) => {
  const match = String(entry).match(/^(app\/api\/.+):\d+:(snake|mixed):([a-zA-Z][a-zA-Z0-9_]*)$/);
  return match ? match[1] + ":" + match[2] + ":" + match[3] : null;
};

const createBaselineAllowance = (entries) => {
  const counts = new Map();
  for (const entry of entries) {
    const signature = parseBaselineSignature(entry);
    if (!signature) continue;
    counts.set(signature, (counts.get(signature) ?? 0) + 1);
  }
  return (relativePath, kind, key) => {
    const signature = relativePath + ":" + kind + ":" + key;
    const remaining = counts.get(signature) ?? 0;
    if (remaining <= 0) return false;
    counts.set(signature, remaining - 1);
    return true;
  };
};

const baselineAllows = createBaselineAllowance(loadJson(BASELINE_PATH, []));
const exceptionsRaw = loadJson(EXCEPTIONS_PATH, { files: {}, keys: {} });
const exceptionFiles = new Set(Object.keys(exceptionsRaw.files ?? {}));
const exceptionKeys = new Set(Object.keys(exceptionsRaw.keys ?? {}));

const findKeys = (filePath, source) => {
  const keys = [];
  const lines = source.split("\n");
  const keyRegex = /(?:^\s*|[,{;]\s*)(?:"([a-zA-Z][a-zA-Z0-9_]*)"|'([a-zA-Z][a-zA-Z0-9_]*)'|([a-zA-Z][a-zA-Z0-9_]*))\s*:/g;

  lines.forEach((line, index) => {
    let match;
    while ((match = keyRegex.exec(line))) {
      const key = match[1] ?? match[2] ?? match[3];
      if (!isLikelyFieldKey(key)) continue;
      keys.push({
        key,
        line: index + 1,
        allowSnake: line.includes(ALLOW_SNAKE_COMMENT),
        allowMixed: line.includes(ALLOW_MIXED_COMMENT),
      });
    }
  });

  return keys;
};

const collectRouteFiles = (dir) => {
  const entries = readdirSync(dir);
  const out = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    const fileStat = statSync(fullPath);
    if (fileStat.isDirectory()) {
      out.push(...collectRouteFiles(fullPath));
      continue;
    }
    if (fullPath.endsWith(path.join("app", "api")) || fullPath.includes(`${path.sep}node_modules${path.sep}`)) continue;
    if (fullPath.endsWith(`${path.sep}route.ts`) && fullPath.includes(`${path.sep}app${path.sep}api${path.sep}`)) {
      out.push(path.relative(ROOT, fullPath));
    }
  }
  return out;
};

if (process.argv.includes("--self-test")) {
  const allows = createBaselineAllowance([
    "app/api/example/route.ts:10:snake:legacy_key",
    "app/api/example/route.ts:20:snake:legacy_key",
    "app/api/example/route.ts:30:mixed:legacy_key",
  ]);
  const parsedKeys = findKeys("app/api/example/route.ts", [
    "const payload = { legacy_key: 1, camelKey: 2 };",
    'const mode = value === "legacy_value" ? "legacy_value" : "other";',
    "type Row = { another_key: string; normalKey: string };",
  ].join("\n"));
  const checks = [
    allows("app/api/example/route.ts", "snake", "legacy_key") === true,
    allows("app/api/example/route.ts", "snake", "legacy_key") === true,
    allows("app/api/example/route.ts", "snake", "legacy_key") === false,
    allows("app/api/example/route.ts", "mixed", "legacy_key") === true,
    allows("app/api/example/route.ts", "mixed", "legacy_key") === false,
    allows("app/api/other/route.ts", "snake", "legacy_key") === false,
    parsedKeys.some((item) => item.key === "legacy_key"),
    parsedKeys.some((item) => item.key === "another_key"),
    !parsedKeys.some((item) => item.key === "legacy_value"),
  ];
  if (checks.some((value) => !value)) {
    console.error("[check:api-dto] baseline allowance self-test FAIL");
    process.exit(1);
  }
  console.log("[check:api-dto] baseline allowance self-test PASS");
  process.exit(0);
}

const files = collectRouteFiles(path.join(ROOT, "app", "api"));
const violations = [];

for (const relativePath of files) {
  const absolutePath = path.join(ROOT, relativePath);
  const source = readFileSync(absolutePath, "utf8");
  const keys = findKeys(relativePath, source);

  const normalizedMap = new Map();
  for (const entry of keys) {
    if (!normalizedMap.has(normalize(entry.key))) normalizedMap.set(normalize(entry.key), []);
    normalizedMap.get(normalize(entry.key)).push(entry);

    const violationId = `${relativePath}:${entry.line}:snake:${entry.key}`;
    if (!isSnakeCase(entry.key)) continue;
    if (entry.allowSnake) continue;
    if (exceptionFiles.has(relativePath)) continue;
    if (exceptionKeys.has(entry.key)) continue;
    if (baselineAllows(relativePath, "snake", entry.key)) continue;
    violations.push(`${violationId} (new snake_case key in API route)`);
  }

  for (const [_, variants] of normalizedMap) {
    const snakeVariants = variants.filter((item) => isSnakeCase(item.key));
    const camelVariants = variants.filter((item) => !isSnakeCase(item.key) && /[A-Z]/.test(item.key));
    if (!snakeVariants.length || !camelVariants.length) continue;

    for (const snakeEntry of snakeVariants) {
      const violationId = `${relativePath}:${snakeEntry.line}:mixed:${snakeEntry.key}`;
      if (snakeEntry.allowMixed) continue;
      if (exceptionFiles.has(relativePath)) continue;
      if (baselineAllows(relativePath, "mixed", snakeEntry.key)) continue;
      violations.push(`${violationId} (mixed field variants with camelCase detected)`);
    }
  }
}

if (violations.length) {
  console.error("[check:api-dto] FAIL");
  for (const item of violations) {
    console.error(` - ${item}`);
  }
  console.error("Use scripts/guard/api-key-exceptions.json or inline allow comments only for unavoidable legacy compatibility.");
  process.exit(1);
}

console.log("[check:api-dto] OK");
