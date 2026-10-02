#!/usr/bin/env node

import fs from "fs";

const sourceFromArg = (() => {
  const logArg = process.argv.find((arg) => arg.startsWith("--log="));
  if (!logArg) return null;
  const filePath = logArg.slice("--log=".length);
  if (!filePath) return null;
  return fs.readFileSync(filePath, "utf8");
})();

const source = sourceFromArg ?? fs.readFileSync(0, "utf8");
const text = source || "";

const mappings = [
  {
    id: "hooks",
    patterns: [/react-hooks\/rules-of-hooks/i, /invalid hook call/i, /hook .*cannot be called/i],
    doc: "docs/ERROR_PLAYBOOK.md",
    section: "React Hooks",
  },
  {
    id: "typescript",
    patterns: [/TS\d{3,5}/, /Type '.*' is not assignable/i, /cannot find name/i],
    doc: "docs/ERROR_PLAYBOOK.md",
    section: "TypeScript",
  },
  {
    id: "snake-case",
    patterns: [/snake_case/i, /check:api-dto/i, /api dto/i],
    doc: "docs/ERROR_PLAYBOOK.md",
    section: "API snake_case 키",
  },
  {
    id: "mixed-variants",
    patterns: [/mixed field/i, /studentId.*student_id/i, /field variants/i],
    doc: "docs/ERROR_PLAYBOOK.md",
    section: "Mixed field variants",
  },
  {
    id: "hardcoded",
    patterns: [/hardcoded/i, /check:no-hardcoded/i, /literal domain/i],
    doc: "docs/ERROR_PLAYBOOK.md",
    section: "Hardcoded elements",
  },
];

const matched = mappings.filter((mapping) => mapping.patterns.some((pattern) => pattern.test(text)));

if (!matched.length) {
  console.log("[fix-guidance] No known pattern matched.");
  console.log("[fix-guidance] Start from docs/ERROR_PLAYBOOK.md and apply minimal, no-behavior-change fixes.");
  process.exit(0);
}

console.log("[fix-guidance] Matched CI/build error guidance:");
for (const entry of matched) {
  console.log(`- ${entry.id}: follow ${entry.doc} → ${entry.section}`);
}
