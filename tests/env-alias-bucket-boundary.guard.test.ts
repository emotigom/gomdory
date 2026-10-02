import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const SKIP_DIRS = new Set([".git", "node_modules", ".next", "coverage", "dist", "template"]);

const TARGET_DIRS = ["app", "lib", "scripts", "tests", "docs"] as const;

const aliasAllowlist: Record<string, { bucket: string; files: Set<string> }> = {
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
    bucket: "removed",
    files: new Set([
      "lib/env/appConfig.ts",
      "scripts/check-build-env.mjs",
      "tests/env-alias-bucket-boundary.guard.test.ts",
    ]),
  },
  SUPABASE_ANON_KEY: {
    bucket: "removed",
    files: new Set([
      "lib/env/appConfig.ts",
      "scripts/check-build-env.mjs",
      "tests/env-alias-bucket-boundary.guard.test.ts",
    ]),
  },
  NEXT_BUILD_ID: {
    bucket: "removed",
    files: new Set([
      "lib/env/appConfig.ts",
      // Removed-alias detector and operator warning boundary.
      "scripts/check-build-env.mjs",
      "tests/env-alias-bucket-boundary.guard.test.ts",
    ]),
  },
  NEXT_PUBLIC_BUILD_ID: {
    bucket: "removed",
    files: new Set([
      "lib/env/appConfig.ts",
      // Removed-alias detector and operator warning boundary.
      "scripts/check-build-env.mjs",
      "tests/env-alias-bucket-boundary.guard.test.ts",
    ]),
  },
};

function collectFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectFiles(abs));
      continue;
    }
    if (!entry.isFile()) continue;
    if (/\.(png|jpg|jpeg|gif|ico|woff2?|ttf|eot|zip|pdf|mp4|webm|avif|lock)$/i.test(entry.name)) continue;
    out.push(abs);
  }
  return out;
}

for (const [alias, policy] of Object.entries(aliasAllowlist)) {
  test(`legacy alias ${alias} is confined to ${policy.bucket} boundaries`, () => {
    const files = TARGET_DIRS.flatMap((dir) => collectFiles(path.join(repoRoot, dir)));
    const matcher = new RegExp(`\\b${alias}\\b`, "g");
    const violations: string[] = [];

    for (const absPath of files) {
      const relativePath = path.relative(repoRoot, absPath).split(path.sep).join("/");
      const source = fs.readFileSync(absPath, "utf8");
      if (!matcher.test(source)) continue;
      matcher.lastIndex = 0;
      if (!policy.files.has(relativePath)) {
        violations.push(relativePath);
      }
    }

    assert.equal(
      violations.length,
      0,
      `Found ${alias} (${policy.bucket}) outside allowlist. Allowed files: ${[...policy.files].join(", ")}\nViolations:\n${violations.join("\n")}`,
    );
  });
}
