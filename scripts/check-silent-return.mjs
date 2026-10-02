#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";

const repoRoot = process.cwd();
const targetDir = path.join(repoRoot, "app", "dashboard");
const targetPattern = /^useDashboard.*\.ts$/;

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function isCommentLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("*/")
  );
}

function isReturnLine(line) {
  return /^\s*return;\s*(?:\/\/.*)?$/.test(line);
}

function stripInlineNoise(line) {
  const withoutBlock = line.replace(/\/\*.*?\*\//g, "");
  const withoutLineComment = withoutBlock.replace(/\/\/.*$/, "");
  return withoutLineComment.replace(/(["'`]).*?\1/g, "");
}

function countBraces(line) {
  const cleaned = stripInlineNoise(line);
  const openCount = (cleaned.match(/\{/g) || []).length;
  const closeCount = (cleaned.match(/\}/g) || []).length;
  return openCount - closeCount;
}

function isFunctionStart(line) {
  const cleaned = stripInlineNoise(line);
  return (
    (/\bfunction\b/.test(cleaned) && cleaned.includes("{")) ||
    /=>\s*\{/.test(cleaned)
  );
}

async function listTargetFiles() {
  try {
    const entries = await fs.readdir(targetDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && targetPattern.test(entry.name))
      .map((entry) => path.join(targetDir, entry.name));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

function collectViolations(content, filePath) {
  const violations = [];
  const lines = content.split(/\r?\n/);
  let braceDepth = 0;
  const functionDepths = [];
  const mutationScopes = [];
  let notifyPending = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    const isComment = isCommentLine(line);
    const currentFunctionDepth =
      functionDepths.length > 0 ? functionDepths[functionDepths.length - 1] : 0;

    if (!isComment) {
      if (notifyPending) {
        if (trimmed.length === 0) {
          // keep waiting
        } else if (isReturnLine(line)) {
          violations.push({
            filePath,
            line: index + 1,
            rule: "notifyOffline return",
            text: trimmed,
          });
          notifyPending = null;
        } else {
          notifyPending = null;
        }
      }

      if (/notifyOffline\s*\(/.test(line)) {
        if (/notifyOffline\s*\(.*\).*\breturn;/.test(line)) {
          violations.push({
            filePath,
            line: index + 1,
            rule: "notifyOffline return",
            text: trimmed,
          });
        } else {
          notifyPending = { line: index + 1 };
        }
      }

      if (/beginMutation\s*\(/.test(line)) {
        mutationScopes.push(currentFunctionDepth);
      }

      if (
        isReturnLine(line) &&
        mutationScopes.some((depth) => depth === currentFunctionDepth)
      ) {
        violations.push({
          filePath,
          line: index + 1,
          rule: "beginMutation return",
          text: trimmed,
        });
      }
    }

    if (!isComment) {
      const braceDelta = countBraces(line);
      braceDepth += braceDelta;

      if (braceDelta > 0 && isFunctionStart(line)) {
        functionDepths.push(braceDepth);
      }

      for (let i = functionDepths.length - 1; i >= 0; i -= 1) {
        if (braceDepth < functionDepths[i]) {
          functionDepths.splice(i, 1);
        }
      }

      for (let i = mutationScopes.length - 1; i >= 0; i -= 1) {
        if (
          functionDepths.length === 0 ||
          mutationScopes[i] > functionDepths[functionDepths.length - 1]
        ) {
          mutationScopes.splice(i, 1);
        }
      }
    }
  }

  return violations;
}

async function main() {
  const files = await listTargetFiles();
  const violations = [];

  for (const filePath of files) {
    const content = await fs.readFile(filePath, "utf8");
    violations.push(...collectViolations(content, filePath));
  }

  if (violations.length > 0) {
    console.error("[check:silent-return] Violations detected:");
    violations.forEach((violation) => {
      const relative = toPosix(path.relative(repoRoot, violation.filePath));
      console.error(
        `- ${relative}:${violation.line} (${violation.rule}) ${violation.text}`,
      );
    });
    process.exit(1);
  }

  console.log("[check:silent-return] OK");
}

main().catch((error) => {
  console.error("[check:silent-return] Failed to run:", error);
  process.exit(1);
});
