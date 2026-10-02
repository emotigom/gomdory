import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const TABLES = [
  "audit_events",
  "billing_events",
  "coupon_codes",
  "coupon_redemptions",
  "edu_feature_flags",
  "license_keys",
  "moderation_hides",
  "community_comment_moderation",
  "ops_banners",
  "reports",
  "site_content",
  "site_content_revisions",
] as const;

const normalize = (value: string) => value.split(path.sep).join("/");

const collectFiles = (dir: string): string[] => {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(absolutePath));
      continue;
    }

    if (!entry.isFile() || !/\.[cm]?[jt]sx?$/.test(entry.name)) {
      continue;
    }

    files.push(absolutePath);
  }

  return files;
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const appDir = path.join(repoRoot, "app");
const componentsDir = path.join(repoRoot, "components");
const libDir = path.join(repoRoot, "lib");

const appFiles = collectFiles(appDir);
const componentFiles = collectFiles(componentsDir);
const libFiles = collectFiles(libDir);

const appUseClientFiles = appFiles.filter((file) => {
  const source = fs.readFileSync(file, "utf8");
  return /^\s*["']use client["'];?/m.test(source);
});

const appComponentFiles = appFiles.filter((file) => /\/components\//.test(normalize(path.relative(repoRoot, file))));
const libBrowserClientFiles = libFiles.filter((file) => {
  const source = fs.readFileSync(file, "utf8");
  return source.includes("createBrowserClient") || source.includes("supabase-browser");
});

const clientRiskFiles = Array.from(
  new Set([...appUseClientFiles, ...appComponentFiles, ...componentFiles, ...libBrowserClientFiles]),
).sort();

const tablePatterns = TABLES.map((table) => {
  const escapedTable = escapeRegex(table);

  return {
    table,
    fromPattern: new RegExp(`\\bfrom\\s*\\(\\s*['"\\x60]${escapedTable}['"\\x60]\\s*\\)`, "i"),
    sqlPattern: new RegExp(
      `\\b(insert\\s+into|update|delete\\s+from|join|from)\\s+(?:public\\.)?['"\\x60]?${escapedTable}['"\\x60]?\\b`,
      "i",
    ),
  };
});

test("service_role RLS tables are never referenced in client-risk files", () => {
  const violations: string[] = [];

  for (const absolutePath of clientRiskFiles) {
    const relativePath = normalize(path.relative(repoRoot, absolutePath));
    const lines = fs.readFileSync(absolutePath, "utf8").split(/\r?\n/);

    lines.forEach((line, index) => {
      for (const { table, fromPattern, sqlPattern } of tablePatterns) {
        if (!fromPattern.test(line) && !sqlPattern.test(line)) {
          continue;
        }

        const matchType = fromPattern.test(line) ? "Supabase from()" : "SQL";
        violations.push(
          `Forbidden ${matchType} table reference to ${table} in client context: ${relativePath}:${index + 1}`,
        );
      }
    });
  }

  if (violations.length > 0) {
    assert.fail(violations.join("\n"));
  }
});
