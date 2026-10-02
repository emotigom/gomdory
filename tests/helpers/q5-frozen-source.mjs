import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { parseFilename } from "../../scripts/qa/q5-supabase-migration-chain-checker.mjs";

// Test fixture only: never an operational source, approval, or live rebaseline.
const ORIGINAL_DIGEST = "aa5ed2ec65fc0f4dee0084b0e7902ef4c7bcb49d73069efae5ba3d137ba09f24";
const INVENTORY_DIGEST = "15a01bdb5dcb4ad5bdd02563a5f6ada598260f7f63131cd1d11c002000fa1029";
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : value && typeof value === "object" ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}` : JSON.stringify(value);
const digest = value => crypto.createHash("sha256").update(canonical(value)).digest("hex");
const RENAMES = Object.freeze({
  "20241101120000_trust_safety.sql": "20241101120001_trust_safety.sql",
  "20250214120000_institution_billing.sql": "20251215100001_institution_billing.sql",
  "20250315120000_add_classes.sql": "20250315120001_add_classes.sql",
  "20260113_fix_board_rls_recursion.sql": "20260113054804_fix_board_rls_recursion.sql",
  "20260218150000_site_content_blocks_v2.sql": "20260218150001_site_content_blocks_v2.sql",
  "20260525100000_add_student_app_submission_versions.sql": "20260525100001_add_student_app_submission_versions.sql",
  "20261115110000_soft_delete_boards_cards_files_v1.sql": "20261115110001_soft_delete_boards_cards_files_v1.sql",
  "20261220090000_create_decorate_plan_cache.sql": "20261220090001_create_decorate_plan_cache.sql",
});
const MANIFEST = "config/q5-supabase-clean-project-baseline-derivation.json";
const originalBilling = "supabase/migrations/20250214120000_institution_billing.sql";
const currentBilling = "supabase/migrations/20251215100001_institution_billing.sql";

function historicalManifest(value) {
  const undo = item => Array.isArray(item) ? item.map(undo)
    : item && typeof item === "object" ? Object.fromEntries(Object.entries(item).map(([key, child]) => [key, undo(child)]))
      : item === currentBilling ? originalBilling : item;
  const result = undo(value);
  const billing = result.nodes.find(node => node.relativePath === originalBilling);
  assert.ok(billing, "Frozen billing node must be present");
  billing.version = "20250214120000";
  assert.equal(digest(result), ORIGINAL_DIGEST, "Frozen manifest reconstruction must match its independent historical digest");
  return result;
}

export function createFrozenQ5Source(sourceRoot = process.cwd()) {
  const readSource = relative => {
    const full = path.join(sourceRoot, relative);
    assert.ok(fs.lstatSync(full).isFile(), `Expected regular source file: ${relative}`);
    return fs.readFileSync(full);
  };
  const manifest = historicalManifest(JSON.parse(readSource(MANIFEST)));
  const nodes = manifest.nodes.map(node => {
    assert.match(node.relativePath, /^supabase\/migrations\/[a-z0-9_]+\.sql$/);
    const basename = path.posix.basename(node.relativePath);
    const raw = readSource(`supabase/migrations/${RENAMES[basename] ?? basename}`);
    return { relativePath: node.relativePath, ...parseFilename(basename), raw };
  }).sort((a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : a.relativePath < b.relativePath ? -1 : a.relativePath > b.relativePath ? 1 : 0)
    .map((node, baseOrderIndex) => ({ ...node, baseOrderIndex }));
  assert.equal(nodes.length, 184);
  assert.equal(new Set(nodes.map(node => node.relativePath)).size, 184);
  const hash = crypto.createHash("sha256");
  for (const node of nodes) hash.update(node.relativePath).update("\0").update(node.raw).update("\0");
  assert.equal(hash.digest("hex"), INVENTORY_DIGEST, "Every frozen source byte and path must match; never bless current drift");
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "gom-q5-frozen-test-")));
  let closed = false;
  const close = () => { if (!closed) { closed = true; fs.rmSync(root, { recursive: true, force: false }); } };
  try {
    for (const node of nodes) {
      const target = path.join(root, node.relativePath);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, node.raw, { flag: "wx" });
    }
    fs.mkdirSync(path.join(root, "config"));
    for (const name of fs.readdirSync(path.join(sourceRoot, "config"))) {
      if (/^q5-[a-z0-9-]+\.json$/.test(name)) fs.writeFileSync(path.join(root, "config", name), readSource(`config/${name}`), { flag: "wx" });
    }
    fs.writeFileSync(path.join(root, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
    const copied = new Set();
    const copyScript = name => {
      assert.match(name, /^q5-[a-z0-9-]+\.mjs$/);
      if (copied.has(name)) return;
      copied.add(name);
      const source = readSource(`scripts/qa/${name}`).toString("utf8");
      fs.mkdirSync(path.join(root, "scripts/qa"), { recursive: true });
      fs.writeFileSync(path.join(root, "scripts/qa", name), source, { flag: "wx" });
      for (const match of source.matchAll(/from\s+["']\.\/([^"']+\.mjs)["']/g)) copyScript(match[1]);
    };
    for (const name of [
      "q5-supabase-migration-chain-checker.mjs", "q5-supabase-migration-dependency-resolver.mjs",
      "q5-supabase-clean-project-baseline-classifier.mjs", "q5-supabase-baseline-derivation-decision-resolver.mjs",
      "q5-supabase-offline-disposable-local-replay-preflight.mjs", "q5-supabase-offline-disposable-local-replay-bundle-planner.mjs",
    ]) copyScript(name);
    return {
      root, nodes, manifest, close,
      read: relative => fs.readFileSync(path.join(root, relative), "utf8"),
      run: (script, args = []) => {
        assert.ok(copied.has(path.posix.basename(script)), "Only copied Q5 CLI modules may run");
        assert.equal(script, `scripts/qa/${path.posix.basename(script)}`);
        return spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: "utf8", timeout: 20000, maxBuffer: 2 * 1024 * 1024 });
      },
      evaluate: source => spawnSync(process.execPath, ["--input-type=module", "-e", source], {
        cwd: root, encoding: "utf8", timeout: 20000, maxBuffer: 2 * 1024 * 1024,
      }),
    };
  } catch (error) { close(); throw error; }
}
