#!/usr/bin/env node

import fs from "node:fs";

function readSource() {
  const logFlagIndex = process.argv.findIndex((arg) => arg === "--log");
  if (logFlagIndex >= 0) {
    const filePath = process.argv[logFlagIndex + 1];
    if (!filePath) {
      throw new Error("Missing path after --log");
    }
    return fs.readFileSync(filePath, "utf8");
  }

  const equalFlag = process.argv.find((arg) => arg.startsWith("--log="));
  if (equalFlag) {
    return fs.readFileSync(equalFlag.slice("--log=".length), "utf8");
  }

  return fs.readFileSync(0, "utf8");
}

const docsBase = "docs/ERROR_PLAYBOOK.md";
const groups = [
  {
    tag: "react-hook-rules",
    section: "[react-hook-rules] React Hook Rules",
    patterns: [/react-hooks\/rules-of-hooks/i, /react-hooks\/exhaustive-deps/i, /invalid hook call/i],
  },
  {
    tag: "typescript-build",
    section: "[typescript-build] TypeScript Build Errors",
    patterns: [/\bTS\d{3,5}\b/, /type error:/i, /is not assignable to type/i, /cannot find name/i],
  },
  {
    tag: "api-route-snake-case",
    section: "[api-route-snake-case] snake_case keys in API routes",
    patterns: [/new snake_case keys in api routes/i, /snake_case keys in api routes/i],
  },
  {
    tag: "dto-snake-case-nearby",
    section: "[dto-snake-case-nearby] New snake_case keys near API response DTOs",
    patterns: [/new snake_case keys near api response dtos/i, /snake_case keys near api response dtos/i],
  },
  {
    tag: "mixed-field-variants",
    section: "[mixed-field-variants] Mixed field variants",
    patterns: [/new mixed field variants detected/i, /mixed field variants/i, /studentId.*student_id/i],
  },
  {
    tag: "hardcoded-elements",
    section: "[hardcoded-elements] Hardcoded elements",
    patterns: [/new hardcoded \/api\/v1\//i, /new hardcoded \/api\//i, /check:no-hardcoded/i, /literal domain/i],
  },
];

try {
  const raw = readSource();
  const text = raw || "";
  const matched = groups.filter((group) => group.patterns.some((pattern) => pattern.test(text)));

  if (matched.length === 0) {
    console.log("[check:buildlog] tag=unknown");
    console.log(`[check:buildlog] docs=${docsBase}#공통-루프`);
    console.log("[check:buildlog] No known group matched. Start with minimal fix loop.");
    process.exit(0);
  }

  console.log(`[check:buildlog] matched=${matched.length}`);
  for (const group of matched) {
    console.log(`[check:buildlog] tag=${group.tag}`);
    console.log(`[check:buildlog] docs=${docsBase}#${group.section.replace(/\s+/g, "-")}`);
  }
} catch (error) {
  console.error(`[check:buildlog] FAIL: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
