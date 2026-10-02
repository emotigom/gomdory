import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const envInventory = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "scripts", "ssot", "env.inventory.json"), "utf8"),
) as {
  legacyAliases?: Array<{
    alias: string;
    canonical: string;
    status: string;
    bucket: string;
  }>;
};

const TARGETS = (envInventory.legacyAliases ?? [])
  .filter((entry) => entry.bucket === "provider-critical/backend-proxy")
  .map((entry) => entry.alias);

const ALLOWLIST = new Set([
  // deprecate-only-runtime-fallback/provider-critical bucket boundary,
  "lib/env/appConfig.ts",
  "scripts/ssot/check.mjs",
  "scripts/ssot/env.contract.test.mjs",
  "scripts/ssot/env.inventory.json",
  "docs/SSOT_ENV.md",
  "docs/edu/phase-61-lesson-ai-structural-inventory.md",
  "docs/edu/phase-64-env-config-runtime-inventory-alignment.md",
  "tests/env-proxy-alias-boundary.guard.test.ts",
]);

const SKIP_DIRS = new Set([".git", "node_modules", ".next", "coverage", "dist", "template"]);

function collectFiles(dir: string): string[] {
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

test("legacy backend-proxy EDU_LLM_* aliases stay confined to runtime fallback code and explicit SSOT inventory/docs", () => {
  assert.ok(TARGETS.length > 0, "expected backend-proxy legacy aliases in scripts/ssot/env.inventory.json");

  const files = collectFiles(repoRoot);
  const violations: string[] = [];

  for (const absPath of files) {
    const relativePath = path.relative(repoRoot, absPath).split(path.sep).join("/");
    const source = fs.readFileSync(absPath, "utf8");

    for (const alias of TARGETS) {
      if (!source.includes(alias)) continue;
      if (!ALLOWLIST.has(relativePath)) {
        violations.push(`${relativePath} -> ${alias}`);
      }
    }
  }

  assert.equal(
    violations.length,
    0,
    `Found disallowed legacy backend-proxy alias spellings outside the explicit runtime-fallback/SSOT boundary. Allowed files: ${[...ALLOWLIST].join(", ")}\nViolations:\n${violations.join("\n")}`,
  );
});
