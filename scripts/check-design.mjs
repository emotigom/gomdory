#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";

const repoRoot = process.cwd();
const appDir = path.join(repoRoot, "app");
const baselinePath = path.join(repoRoot, "scripts", "check-design.baseline.json");

const forbiddenTokens = [];

const roundedTokens = new Set(["rounded-2xl", "rounded-3xl", "rounded-full"]);
const roundedAllowlist = new Set([
  "app/s/[code]/_components/CardTile.tsx",
  "app/s/[code]/components/StudentQuestionCard.tsx",
  "app/s/[code]/components/StudentStepCard.tsx",
  "app/s/[code]/components/QuickPollCard.tsx",
  "app/s/[code]/components/feed/components/FeedCardPreview.tsx",
  "app/dashboard/boards/[boardId]/class/CardRow.tsx",
  "app/dashboard/boards/[boardId]/class/CardListBody.tsx",
  "app/dashboard/boards/[boardId]/class/CardListSection.tsx",
  "app/dashboard/boards/[boardId]/class/CardListHeader.tsx",
  "app/dashboard/boards/[boardId]/class/CardForm.tsx",
]);

const textExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const updateBaseline = process.argv.includes("--update-baseline");

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&");
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "_legacy") {
        continue;
      }
      files.push(...(await walk(entryPath)));
    } else if (entry.isFile()) {
      if (textExtensions.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  }

  return files;
}

function countTokensInFile(content, relativePath) {
  const lines = content.split(/\r?\n/);
  const tokenInfo = new Map();

  for (const token of forbiddenTokens) {
    if (roundedTokens.has(token) && roundedAllowlist.has(relativePath)) {
      continue;
    }

    const regex = new RegExp(escapeRegExp(token), "g");
    let count = 0;
    const lineNumbers = [];

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const matches = line.match(regex);
      if (matches) {
        count += matches.length;
        lineNumbers.push(index + 1);
      }
    }

    if (count > 0) {
      tokenInfo.set(token, { count, lineNumbers });
    }
  }

  return tokenInfo;
}

async function loadBaseline() {
  try {
    const raw = await fs.readFile(baselinePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { files: {} };
    }
    throw error;
  }
}

async function writeBaseline(data) {
  const payload = {
    generatedAt: new Date().toISOString(),
    files: data,
  };
  await fs.writeFile(baselinePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const appFiles = await walk(appDir);
  const fileSummaries = {};

  for (const filePath of appFiles) {
    const relativePath = toPosix(path.relative(repoRoot, filePath));
    const content = await fs.readFile(filePath, "utf8");
    const tokenInfo = countTokensInFile(content, relativePath);

    if (tokenInfo.size > 0) {
      fileSummaries[relativePath] = Object.fromEntries(
        Array.from(tokenInfo.entries()).map(([token, info]) => [
          token,
          { count: info.count, lineNumbers: info.lineNumbers },
        ]),
      );
    }
  }

  if (updateBaseline) {
    await writeBaseline(fileSummaries);
    console.log("[check:design] Baseline updated.");
    return;
  }

  const baseline = await loadBaseline();
  const violations = [];

  for (const [filePath, tokens] of Object.entries(fileSummaries)) {
    const baselineTokens = baseline.files?.[filePath] ?? {};

    for (const [token, info] of Object.entries(tokens)) {
      const allowedCount = baselineTokens[token]?.count ?? 0;
      if (info.count > allowedCount) {
        violations.push({
          filePath,
          token,
          count: info.count,
          allowedCount,
          lineNumbers: info.lineNumbers,
        });
      }
    }
  }

  if (violations.length > 0) {
    console.error("[check:design] Forbidden design tokens detected:");
    for (const violation of violations) {
      const lines = violation.lineNumbers.length
        ? ` lines: ${violation.lineNumbers.join(", ")}`
        : "";
      console.error(
        `- ${violation.filePath} (${violation.token}) count: ${violation.count} allowed: ${violation.allowedCount}${lines}`,
      );
    }
    process.exit(1);
  }

  console.log("[check:design] OK");
}

main().catch((error) => {
  console.error("[check:design] Failed to run:", error);
  process.exit(1);
});
