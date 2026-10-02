import fs from "node:fs/promises";
import path from "node:path";

const scanRoots = ["app", "lib"];
const allowedFiles = new Set([
  "lib/supabase/client.ts",
  "lib/hooks/useWallRealtime.ts",
]);
const extensions = new Set([".ts", ".tsx", ".js", ".jsx"]);
const patterns = [
  { label: "createSupabaseBrowserClient(", regex: /createSupabaseBrowserClient\s*\(/ },
  { label: ".channel(", regex: /\.channel\s*\(/ },
  { label: "'postgres_changes'", regex: /['\"]postgres_changes['\"]/, },
];

const rootDir = process.cwd();

async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    if (entry.isFile() && extensions.has(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }

  return files;
}

function toRepoPath(filePath) {
  return path.relative(rootDir, filePath).split(path.sep).join("/");
}

function findMatches(contents) {
  return patterns.filter((pattern) => pattern.regex.test(contents));
}

async function main() {
  const targets = [];

  for (const root of scanRoots) {
    const absoluteRoot = path.join(rootDir, root);
    if (await pathExists(absoluteRoot)) {
      targets.push(...(await walk(absoluteRoot)));
    }
  }

  const violations = [];

  for (const filePath of targets) {
    const contents = await fs.readFile(filePath, "utf8");
    const matches = findMatches(contents);

    if (matches.length === 0) {
      continue;
    }

    const repoPath = toRepoPath(filePath);

    if (!allowedFiles.has(repoPath)) {
      violations.push({
        file: repoPath,
        matches: matches.map((match) => match.label),
      });
    }
  }

  if (violations.length > 0) {
    console.error("Disallowed client Supabase usage detected:");
    for (const violation of violations) {
      console.error(`- ${violation.file} (matches: ${violation.matches.join(", ")})`);
    }
    console.error("");
    console.error("Allowed files:");
    for (const allowed of [...allowedFiles].sort()) {
      console.error(`- ${allowed}`);
    }
    console.error("");
    console.error(
      "If you add a new client Supabase access path, update docs/security/client-supabase-access.md and adjust the allowlist in this script.",
    );
    process.exit(1);
  }
}

await main();
