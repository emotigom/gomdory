import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../../..");
export const NODE = process.execPath;
const npmCliCandidates = [
  process.env.npm_execpath,
  path.resolve(path.dirname(process.execPath), "node_modules/npm/bin/npm-cli.js"),
  path.resolve(path.dirname(process.execPath), "../lib/node_modules/npm/bin/npm-cli.js"),
].filter((value) => typeof value === "string" && value.length > 0);
export const NPM_CLI = npmCliCandidates.find((candidate) => fs.existsSync(candidate)) ?? npmCliCandidates[0] ?? "npm-cli.js";
const unique = (items) => [...new Set(items.filter(Boolean))].sort();
const textTail = (text, max = 12 * 1024) => text.length > max ? text.slice(-max) : text;
const secret = /authorization|bearer\s+|api[ _-]?key|cookie|fixture[ _-]?token|password|secret|sk-[\w-]+/i;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const CHILD_ENV_KEYS = ["PATH","HOME","TMPDIR","TMP","TEMP","LANG","SystemRoot","SYSTEMROOT","ComSpec","COMSPEC","PATHEXT","USERPROFILE","APPDATA","LOCALAPPDATA"];
export const redact = (text) => secret.test(text) ? { text: "[REDACTED: suspected secret]", redacted: true } : { text: textTail(text), redacted: false };
export function buildChildCleanupPlan(pid, platform = process.platform) {
  if (!Number.isInteger(pid) || pid <= 0) return { kind: "none" };
  if (platform === "win32") return { kind: "taskkill", command: "taskkill", args: ["/PID", String(pid), "/T", "/F"] };
  return { kind: "process-group", groupPid: -pid, termSignal: "SIGTERM", killSignal: "SIGKILL" };
}
function buildChildEnv(extra = {}) {
  const inherited = {};
  for (const key of CHILD_ENV_KEYS) {
    const value = process.env[key];
    if (typeof value === "string" && value.length > 0) inherited[key] = value;
  }
  return { ...inherited, ...extra };
}
function runTaskkill(plan, { spawnImpl = spawn, cwd = ROOT } = {}) {
  return new Promise((resolve) => {
    let stderr = "", settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    let killer;
    try {
      killer = spawnImpl(plan.command, plan.args, { cwd, shell: false, env: buildChildEnv(), windowsHide: true, stdio: ["ignore","ignore","pipe"] });
    } catch (error) {
      finish({ code: null, error: String(error) });
      return;
    }
    killer.stderr?.on?.("data", (value) => { stderr += value.toString(); });
    killer.once("error", (error) => finish({ code: null, error: String(error) }));
    killer.once("close", (code) => finish({ code: code ?? 1, stderrTail: textTail(stderr, 2048) }));
  });
}
export async function stopChildTree(child, { platform = process.platform, spawnImpl = spawn, killImpl = process.kill, sleepImpl = sleep, cwd = ROOT } = {}) {
  if (!child?.pid) return { attempted: false, ok: true, method: "none" };
  const plan = buildChildCleanupPlan(child.pid, platform);
  child.unref?.();
  if (plan.kind === "taskkill") {
    const result = await runTaskkill(plan, { spawnImpl, cwd });
    return { attempted: true, ok: result.code === 0, method: "taskkill", code: result.code, error: result.error ?? null, stderrTail: result.stderrTail ?? "" };
  }
  if (plan.kind !== "process-group") return { attempted: false, ok: true, method: "none" };
  try {
    killImpl(plan.groupPid, plan.termSignal);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH") return { attempted: true, ok: true, method: "process-group", termSignal: plan.termSignal, killSignal: null, alreadyExited: true };
    return { attempted: true, ok: false, method: "process-group", termSignal: plan.termSignal, killSignal: null, error: String(error) };
  }
  await sleepImpl(120);
  let stillAlive = false;
  try {
    killImpl(plan.groupPid, 0);
    stillAlive = true;
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ESRCH")) return { attempted: true, ok: false, method: "process-group", termSignal: plan.termSignal, killSignal: null, error: String(error) };
  }
  if (!stillAlive) return { attempted: true, ok: true, method: "process-group", termSignal: plan.termSignal, killSignal: null };
  try {
    killImpl(plan.groupPid, plan.killSignal);
    return { attempted: true, ok: true, method: "process-group", termSignal: plan.termSignal, killSignal: plan.killSignal };
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ESRCH") return { attempted: true, ok: true, method: "process-group", termSignal: plan.termSignal, killSignal: null, alreadyExited: true };
    return { attempted: true, ok: false, method: "process-group", termSignal: plan.termSignal, killSignal: plan.killSignal, error: String(error) };
  }
}
export function parseNameStatusZ(buffer, source = "commit-range") {
  const fields = buffer.toString("utf8").split("\0").filter(Boolean); const result = [];
  for (let i = 0; i < fields.length;) { const status = fields[i++]; const kind = status[0]; if (["R", "C"].includes(kind)) { const oldPath = fields[i++]; const file = fields[i++]; result.push({ status: kind === "R" ? "renamed" : "copied", oldPath, path: file, changeSource: source }); } else result.push({ status: kind === "D" ? "deleted" : kind === "A" ? "added" : "modified", oldPath: null, path: fields[i++], changeSource: source }); }
  return result;
}
export function normalizeChanges(changes) { const byPath = new Map(); for (const item of changes) { const key = `${item.oldPath ?? ""}\0${item.path}`; const previous = byPath.get(key) ?? { ...item, sources: [] }; previous.sources = unique([...previous.sources, item.changeSource]); byPath.set(key, previous); } return [...byPath.values()].sort((a,b) => a.path.localeCompare(b.path)); }
export function matchRules(files, map) {
  return files.map((file) => { const targets = [file.path, file.oldPath].filter(Boolean); const rules = map.rules.filter((rule) => rule.include.some((needle) => targets.some((target) => target.includes(needle) || target.startsWith(needle)))).sort((a,b) => b.priority-a.priority || a.id.localeCompare(b.id)); const domains = unique(rules.flatMap((r) => r.domains)); const source = /^(app|lib|scripts)\//.test(file.path); if (!rules.length && source) domains.push("unknown"); return { ...file, domains: unique(domains), matchedRuleIds: rules.map((r) => r.id), rules }; });
}
const checks = {
  "targeted-eslint": { tier: 1, title: "Targeted ESLint", command: NODE, args: [], timeoutMs: 180000, dependsOn: [] },
  "check-ui": { tier: 1, title: "UI source guard", command: NODE, args: ["scripts/smoke-check-ui.mjs"], timeoutMs: 180000, dependsOn: [] },
  "route-invariants": { tier: 1, title: "Route invariants", command: NODE, args: ["scripts/guard/route-invariants.mjs"], timeoutMs: 180000, dependsOn: [] },
  "security-fast": { tier: 1, title: "Security fast checks", command: NODE, args: [NPM_CLI, "run", "check:security:fast"], timeoutMs: 300000, dependsOn: [] },
  "docs-linkcheck": { tier: 1, title: "Documentation links", command: NODE, args: ["vendor/docs-link-checker/bin/check.mjs", "docs"], timeoutMs: 180000, dependsOn: [] },
  "docs-context-boundary": { tier: 1, title: "Documentation context boundary", command: NODE, args: ["scripts/guard/check-context-boundary.mjs"], timeoutMs: 180000, dependsOn: [] },
  "test-manifest": { tier: 1, title: "Test manifest", command: NODE, args: ["scripts/qa/check-test-manifest.mjs"], timeoutMs: 180000, dependsOn: [] },
  "b7-contract": { tier: 1, title: "B7 contract", command: NODE, args: ["scripts/qa/q2-b7-teacher-operation.mjs", "--self-test"], timeoutMs: 180000, dependsOn: [] },
  "b9-llm-contract": { tier: 1, title: "B9 LLM contract", command: NODE, args: ["--test", "tests/q2-b9-e-llm-provider-contract.test.mjs"], timeoutMs: 180000, dependsOn: [] },
  "b10-contract": { tier: 1, title: "B10 contract", command: NODE, args: ["--test", "tests/q2-b10-multi-user-polling-contract.test.mjs"], timeoutMs: 180000, dependsOn: [] },
  "b11-contract": { tier: 1, title: "B11 contract", command: NODE, args: ["--test", "tests/q2-b11-design-accessibility-contract.test.mjs"], timeoutMs: 180000, dependsOn: [] },
  "migration-static": { tier: 1, title: "Migration static guard", command: NODE, args: [NPM_CLI, "run", "check:supabase:migrations"], timeoutMs: 180000, dependsOn: [] },
  "b10-browser": { tier: 2, title: "B10 managed Chromium", command: NODE, args: ["scripts/qa/q2-b10-multi-user-polling.mjs", "--browser"], timeoutMs: 900000, dependsOn: ["b10-contract"], requiresGate: true },
  "b11-browser": { tier: 2, title: "B11 managed Chromium", command: NODE, args: ["scripts/qa/q2-b11-design-accessibility.mjs", "--browser"], timeoutMs: 900000, dependsOn: ["b11-contract"], requiresGate: true }
};
export function buildSelection(files, map) { const matched = matchRules(files, map); const selected = new Map(); const manualReview = []; for (const file of matched) { const ids = file.rules.flatMap((r) => [...(r.checks ?? []), ...(r.browserChecks ?? [])]); if (file.domains.includes("unknown")) { ids.push("targeted-eslint", "test-manifest"); manualReview.push("unclassified-source-change"); } for (const r of file.rules) manualReview.push(...(r.manualReview ?? [])); for (const id of ids) if (checks[id]) selected.set(id, { id, ...checks[id] }); }
  const lintFiles = matched.filter((f) => !["deleted"].includes(f.status) && /\.(?:[cm]?[jt]sx?)$/.test(f.path)).map((f) => f.path); if (selected.has("targeted-eslint")) { if (!lintFiles.length) selected.delete("targeted-eslint"); else selected.get("targeted-eslint").args = ["node_modules/eslint/bin/eslint.js", ...lintFiles, "--max-warnings=0"]; }
  const ordered = [...selected.values()].sort((a,b) => a.tier-b.tier || a.id.localeCompare(b.id)); return { files: matched.map(({rules,...f}) => f), domains: unique(matched.flatMap((f) => f.domains)), matchedRules: unique(matched.flatMap((f) => f.matchedRuleIds)), checks: ordered, manualReview: unique(manualReview) };
}
export async function runCheck(check, { cwd = ROOT, env = {} } = {}) {
  const startedAt = new Date().toISOString(), started = Date.now();
  return await new Promise((resolve) => {
    let stdout = "", stderr = "", timedOut = false, settled = false;
    let cleanupPromise = Promise.resolve({ attempted: false, ok: true, method: "not-required" });
    const child = spawn(check.command, check.args, { cwd, shell: false, env: buildChildEnv(env), stdio: ["ignore","pipe","pipe"], detached: true, windowsHide: true });
    const timer = setTimeout(() => {
      timedOut = true;
      cleanupPromise = stopChildTree(child, { cwd });
      void cleanupPromise.then(() => {
        void finish();
      });
    }, check.timeoutMs);
    const finish = async ({ exitCode = null, signal = null, spawnError = null } = {}) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const cleanupDetail = timedOut ? await cleanupPromise : { attempted: false, ok: true, method: "not-required" };
      const a = redact(stdout), b = redact(spawnError ? `${stderr}\n${spawnError}` : stderr);
      resolve({ id: check.id, status: timedOut ? "timed-out" : exitCode === 0 ? "passed" : "failed", exitCode, signal, durationMs: Date.now() - started, startedAt, finishedAt: new Date().toISOString(), stdoutTail: a.text, stderrTail: b.text, redacted: a.redacted || b.redacted, cleanupDetail });
    };
    child.stdout?.on("data", (value) => { stdout += value; });
    child.stderr?.on("data", (value) => { stderr += value; });
    child.once("close", (exitCode, signal) => { void finish({ exitCode: exitCode ?? null, signal: signal ?? null }); });
    child.once("error", (error) => { void finish({ spawnError: String(error) }); });
  });
}
export { checks };
