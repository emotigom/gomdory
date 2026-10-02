import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const apiRoot = path.join(repoRoot, "app", "api", "v1");

const deniedTokens = [
  "owner_user_id",
  "owner_id",
  "board_file_id",
  "card_id",
  "wall_id",
  "board_id",
  "files",
  "board_files",
  "card_files",
] as const;

const tokenPatterns = Object.fromEntries(
  deniedTokens.map((token) => [token, new RegExp(`(?<![\\w/])${token}(?![\\w/])`)]),
) as Record<(typeof deniedTokens)[number], RegExp>;

const routeMatchers = [
  /^files\/.*\/route\.ts$/,
  /^cards\/.*\/files\/.*\/route\.ts$/,
  /^share\/.*\/files\/.*\/route\.ts$/,
];

const isUploadOrAttachmentRoute = (normalizedPath: string) =>
  normalizedPath.includes("/upload/") || normalizedPath.includes("/files/initiate/");

const collectRouteFiles = (dir: string, prefix = ""): string[] => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const relPath = prefix ? path.join(prefix, entry.name) : entry.name;
    const absPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectRouteFiles(absPath, relPath));
      continue;
    }

    if (entry.name === "route.ts") {
      const normalized = relPath.split(path.sep).join("/");
      if (routeMatchers.some((matcher) => matcher.test(normalized)) && isUploadOrAttachmentRoute(normalized)) {
        files.push(path.join(apiRoot, relPath));
      }
    }
  }

  return files;
};

const stripStringsAndComments = (source: string) =>
  source
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^\\:])\/\/.*$/gm, "$1 ")
    .replace(/`(?:\\.|[^`\\])*`/g, " ` ` ")
    .replace(/"(?:\\.|[^"\\])*"/g, ' " " ')
    .replace(/'(?:\\.|[^'\\])*'/g, " ' ' ");

test("upload and attachment API routes avoid DB snake_case tokens", () => {
  const routeFiles = collectRouteFiles(apiRoot).sort();

  assert.ok(routeFiles.length > 0, "No target route files found for snake_case guard.");

  for (const routePath of routeFiles) {
    const source = fs.readFileSync(routePath, "utf8");
    const sanitizedSource = stripStringsAndComments(source);

    for (const token of deniedTokens) {
      assert.equal(
        tokenPatterns[token].test(sanitizedSource),
        false,
        `Found disallowed snake_case token \"${token}\" in ${routePath}. Keep DB snake_case details only in lib/db/** or lib/supabase/admin.ts.`,
      );
    }
  }
});
