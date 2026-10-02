import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "../../..");
export const NODE = process.execPath;
const unique = (items) => [...new Set(items.filter(Boolean))].sort();
const textTail = (text, max = 12 * 1024) => text.length > max ? text.slice(-max) : text;
const secret = /authorization|bearer\s+|api[ _-]?key|cookie|fixture[ _-]?token|password|secret|sk-[\w-]+/i;
export const redact = (text) => secret.test(text) ? { text: "[REDACTED: suspected secret]", redacted: true } : { text: textTail(text), redacted: false };
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
  "security-fast": { tier: 1, title: "Security fast checks", command: "npm", args: ["run", "check:security:fast"], timeoutMs: 300000, dependsOn: [] },
  "docs-linkcheck": { tier: 1, title: "Documentation links", command: NODE, args: ["vendor/docs-link-checker/bin/check.mjs", "docs"], timeoutMs: 180000, dependsOn: [] },
  "docs-context-boundary": { tier: 1, title: "Documentation context boundary", command: NODE, args: ["scripts/guard/check-context-boundary.mjs"], timeoutMs: 180000, dependsOn: [] },
  "test-manifest": { tier: 1, title: "Test manifest", command: NODE, args: ["scripts/qa/check-test-manifest.mjs"], timeoutMs: 180000, dependsOn: [] },
  "b7-contract": { tier: 1, title: "B7 contract", command: NODE, args: ["scripts/qa/q2-b7-teacher-operation.mjs", "--self-test"], timeoutMs: 180000, dependsOn: [] },
  "b9-llm-contract": { tier: 1, title: "B9 LLM contract", command: NODE, args: ["--test", "tests/q2-b9-e-llm-provider-contract.test.mjs"], timeoutMs: 180000, dependsOn: [] },
  "b10-contract": { tier: 1, title: "B10 contract", command: NODE, args: ["--test", "tests/q2-b10-multi-user-polling-contract.test.mjs"], timeoutMs: 180000, dependsOn: [] },
  "b11-contract": { tier: 1, title: "B11 contract", command: NODE, args: ["--test", "tests/q2-b11-design-accessibility-contract.test.mjs"], timeoutMs: 180000, dependsOn: [] },
  "migration-static": { tier: 1, title: "Migration static guard", command: "npm", args: ["run", "check:supabase:migrations"], timeoutMs: 180000, dependsOn: [] },
  "b10-browser": { tier: 2, title: "B10 managed Chromium", command: NODE, args: ["scripts/qa/q2-b10-multi-user-polling.mjs", "--browser"], timeoutMs: 900000, dependsOn: ["b10-contract"], requiresGate: true },
  "b11-browser": { tier: 2, title: "B11 managed Chromium", command: NODE, args: ["scripts/qa/q2-b11-design-accessibility.mjs", "--browser"], timeoutMs: 900000, dependsOn: ["b11-contract"], requiresGate: true }
};
export function buildSelection(files, map) { const matched = matchRules(files, map); const selected = new Map(); const manualReview = []; for (const file of matched) { const ids = file.rules.flatMap((r) => [...(r.checks ?? []), ...(r.browserChecks ?? [])]); if (file.domains.includes("unknown")) { ids.push("targeted-eslint", "test-manifest"); manualReview.push("unclassified-source-change"); } for (const r of file.rules) manualReview.push(...(r.manualReview ?? [])); for (const id of ids) if (checks[id]) selected.set(id, { id, ...checks[id] }); }
  const lintFiles = matched.filter((f) => !["deleted"].includes(f.status) && /\.(?:[cm]?[jt]sx?)$/.test(f.path)).map((f) => f.path); if (selected.has("targeted-eslint")) { if (!lintFiles.length) selected.delete("targeted-eslint"); else selected.get("targeted-eslint").args = ["node_modules/eslint/bin/eslint.js", ...lintFiles, "--max-warnings=0"]; }
  const ordered = [...selected.values()].sort((a,b) => a.tier-b.tier || a.id.localeCompare(b.id)); return { files: matched.map(({rules,...f}) => f), domains: unique(matched.flatMap((f) => f.domains)), matchedRules: unique(matched.flatMap((f) => f.matchedRuleIds)), checks: ordered, manualReview: unique(manualReview) };
}
export async function runCheck(check, { cwd = ROOT, env = {} } = {}) { const startedAt = new Date().toISOString(); const started = Date.now(); return await new Promise((resolve) => { let stdout="", stderr="", timedOut=false; const child = spawn(check.command, check.args, { cwd, shell: false, env: { PATH: process.env.PATH, HOME: process.env.HOME, TMPDIR: process.env.TMPDIR, LANG: process.env.LANG, ...env }, stdio: ["ignore","pipe","pipe"], detached: true }); const timer = setTimeout(() => { timedOut=true; try { process.kill(-child.pid, "SIGTERM"); } catch {} setTimeout(() => { try { process.kill(-child.pid, "SIGKILL"); } catch {} }, 1000).unref(); }, check.timeoutMs); child.stdout.on("data", (v) => { stdout += v; }); child.stderr.on("data", (v) => { stderr += v; }); child.on("close", (exitCode, signal) => { clearTimeout(timer); const a=redact(stdout), b=redact(stderr); resolve({ id:check.id, status: timedOut ? "timed-out" : exitCode === 0 ? "passed" : "failed", exitCode: exitCode ?? null, signal: signal ?? null, durationMs:Date.now()-started, startedAt, finishedAt:new Date().toISOString(), stdoutTail:a.text, stderrTail:b.text, redacted:a.redacted||b.redacted }); }); child.on("error", (error) => { clearTimeout(timer); resolve({id:check.id,status:"failed",exitCode:null,durationMs:Date.now()-started,startedAt,finishedAt:new Date().toISOString(),stdoutTail:"",stderrTail:String(error),redacted:false}); }); }); }
export { checks };
