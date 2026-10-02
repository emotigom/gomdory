#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const wranglerPath = path.join(repoRoot, "wrangler.jsonc");
const wranglerTomlPath = path.join(repoRoot, "wrangler.toml");
const ALLOW_VARS = new Set(
  (process.env.CF_GUARD_ALLOW_WRANGLER_VARS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean),
);
const allowSecretCommands = process.env.CF_GUARD_ALLOW_WRANGLER_SECRET_COMMANDS === "1";
const SOURCE_DIRS = ["scripts", "docs", ".github"];

const stripJsonComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");

function readWrangler() {
  const source = fs.readFileSync(wranglerPath, "utf8");
  return JSON.parse(stripJsonComments(source));
}

function collectVarsPaths(node, trail = ["wrangler"], out = []) {
  if (!node || typeof node !== "object") return out;
  if (Object.prototype.hasOwnProperty.call(node, "vars")) {
    out.push(trail.concat("vars").join("."));
  }
  for (const [key, value] of Object.entries(node)) {
    if (value && typeof value === "object") {
      collectVarsPaths(value, trail.concat(key), out);
    }
  }
  return out;
}


function assertNoWranglerVarsTextPatterns() {
  const files = [wranglerPath, wranglerTomlPath].filter((filePath) => fs.existsSync(filePath));
  const offenders = [];

  const patterns = [
    { label: 'json vars key', regex: /"vars"\s*:/i },
    { label: 'toml [vars] block', regex: /^\s*\[\s*vars\s*\]\s*$/im },
    { label: 'toml [env.*.vars] block', regex: /^\s*\[\s*env\.[^\]]+\.vars\s*\]\s*$/im },
    { label: 'toml env.*.vars assignment', regex: /^\s*env\.[^.\s]+\.vars\s*=\s*/im },
  ];

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, "utf8");
    for (const pattern of patterns) {
      if (pattern.regex.test(source)) {
        offenders.push(`${relative(filePath)} (${pattern.label})`);
      }
    }
  }

  if (offenders.length) {
    throw new Error([
      "Do not store NEXT_PUBLIC_* values in wrangler config; manage in Cloudflare dashboard only.",
      "Detected forbidden wrangler vars declarations:",
      ...offenders.map((entry) => `  - ${entry}`),
    ].join("\n"));
  }
}

function walkFiles(dirPath, collected = []) {
  if (!fs.existsSync(dirPath)) return collected;
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, collected);
      continue;
    }
    collected.push(fullPath);
  }
  return collected;
}

function relative(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function assertNoWranglerSecretCommands() {
  if (allowSecretCommands) {
    console.warn(
      "[cf-guard] WARN: CF_GUARD_ALLOW_WRANGLER_SECRET_COMMANDS=1 set. Skipping wrangler secret command blocklist.",
    );
    return;
  }

  const wranglerWord = "wrangler";
  const secretWord = "secret";
  const regex = new RegExp(`\\b${wranglerWord}\\s+${secretWord}\\s+(put|delete)\\b`, "i");
  const offenders = [];

  for (const sourceDir of SOURCE_DIRS) {
    const absoluteDir = path.join(repoRoot, sourceDir);
    for (const filePath of walkFiles(absoluteDir)) {
      const source = fs.readFileSync(filePath, "utf8");
      const lines = source.split("\n");
      for (let i = 0; i < lines.length; i += 1) {
        if (regex.test(lines[i])) {
          offenders.push(`${relative(filePath)}:${i + 1}`);
        }
      }
    }
  }

  if (offenders.length) {
    throw new Error([
      "Forbidden command usage detected: wrangler secret command (put/delete).",
      "Cloudflare Dashboard is source of truth. Do not manage secrets through wrangler commands in repo scripts/docs.",
      ...offenders.map((entry) => `  - ${entry}`),
      "If this is an intentional exception, set CF_GUARD_ALLOW_WRANGLER_SECRET_COMMANDS=1 explicitly in CI/job.",
    ].join("\n"));
  }
}

function assertStudentRecordsPreviewPlacement(wrangler) {
  if (wrangler?.env?.preview?.placement?.region !== "aws:us-east-1") {
    throw new Error("Preview Worker must retain targeted placement.region aws:us-east-1 for Student Records OpenAI availability.");
  }
  if (Object.prototype.hasOwnProperty.call(wrangler?.env?.production ?? {}, "placement")) {
    throw new Error("Production Worker must not inherit the preview targeted placement automatically.");
  }
  const preview = JSON.parse(fs.readFileSync(path.join(repoRoot, "wrangler.preview.jsonc"), "utf8"));
  if (preview?.placement?.region !== "aws:us-east-1") {
    throw new Error("wrangler.preview.jsonc must retain targeted placement.region aws:us-east-1.");
  }
}

function main() {
  const wrangler = readWrangler();
  const varsPaths = collectVarsPaths(wrangler);
  const blockedVars = varsPaths.filter((entry) => !ALLOW_VARS.has(entry));

  if (blockedVars.length) {
    throw new Error([
      "wrangler.jsonc must not define `vars` blocks (Do not store NEXT_PUBLIC_* values in wrangler config; Dashboard is SSOT).",
      ...blockedVars.map((entry) => `  - ${entry}`),
      "If an exception is required, add an explicit allowlist via CF_GUARD_ALLOW_WRANGLER_VARS=path1,path2",
    ].join("\n"));
  }

  assertNoWranglerVarsTextPatterns();
  assertNoWranglerSecretCommands();
  assertStudentRecordsPreviewPlacement(wrangler);

  console.log("[cf-guard] OK: no wrangler vars blocks and no blocked wrangler secret command usage found.");
}

try {
  main();
} catch (error) {
  console.error(`[cf-guard] FAIL: ${error.message}`);
  process.exit(1);
}
