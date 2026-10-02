#!/usr/bin/env node
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// These are retired repository roles, not words banned from document bodies.
const retired = new Set([
  "gomdory_context.md", "docs/start_here.md", "docs/context.md",
  "docs/project_state.md", "docs/chat_start_prompt.md", "docs/codex_start_here.md",
  "docs/codex_rules.md", "docs/codex_task_template.md", "docs/worklog_rules.md",
  "docs/worklog_template.md", "docs/engineering_contract.md", "docs/pr_checklist.md",
  "docs/edu_handoff_next_chat.md", "docs/refactor_handoff_2026q1.md",
  "docs/world_hub_release_handoff_2026q1.md", "docs/horizon/status.md",
  "docs/horizon/program.md", "docs/product/qa_program_roadmap.md",
  "docs/edu_student_decorate_current_state.md",
  "scripts/guard/check-docs-ssot.mjs", "scripts/guard/check-pr-ack.mjs",
  ".github/workflows/context-guard.yml", ".github/old_pull_request_template.md",
]);
export function retiredContextRole(file) {
  const normalized = file.replaceAll("\\", "/").replace(/^\.\//, "").toLowerCase();
  if (retired.has(normalized)) return true;
  if (/^(?:docs\/ssot|scripts\/handoff)\//.test(normalized)) return true;
  if (/^docs\/(?:project|repository|repo|current|authority|workflow|lifecycle)\/(?:handoff|registry|map|ledger|ssot|state|checkpoint)(?:[./-]|$)/.test(normalized)) return true;
  if (!/^(?:docs\/|[^/]+$)/.test(normalized)) return false;
  const name = path.posix.basename(normalized).replaceAll("_", "-");
  return /^(?:merge-readiness|release-merge-plan|chat-start|codex-start-here|worklog)(?:[.-]|$)/.test(name)
    || /^(?:(?:project|repository|repo|chat|session)-(?:current-)?)?(?:current-state|checkpoint|restart|resume-task|validation)-(?:ledger|registry|map)(?:[.-]|$)/.test(name)
    || /^(?:project|repository|repo|chat|session)-(?:current-)?(?:handoff|context|state|status|checkpoint|ledger|resume|authority)(?:[.-]|$)/.test(name)
    || /^(?:current-(?:handoff|state|context|status)|handoff-(?:registry|ledger)|lifecycle-(?:registry|ledger))(?:[.-]|$)/.test(name)
    || /^(?:authority-(?:map|registry)|workflow-ssot|ssot-workflow)(?:[.-]|$)/.test(name);
}

const sensitiveKeyMatcher = /(SUPABASE|R2|TURNSTILE|SECRET|API[_-]?KEY|PASSWORD|TOKEN|NEXT_PUBLIC_EDU_WEBLLM_)/i;
const placeholderMatcher = /<YOUR_[^>]+>|<set-in-[^>]+>|<placeholder>|\$\{[^}]+\}/i;
const nextPublicKeyMatcher = /\b(NEXT_PUBLIC_[A-Z0-9_]{2,})\b/i;
const suspiciousValueMatcher = /(https?:\/\/|\.com\b|\.workers\.dev\b|[A-Za-z0-9_\-]{24,})/i;
const safeLiteralMatcher = /^[a-z0-9_|\-/]+$/i;

// Preserve the retired context guard's redacted secret/value checks.
export function sensitiveAssignments(relativePath, source) {
  const violations = [];
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const assignmentMatch = rawLine.match(/\b([A-Z][A-Z0-9_]{1,})\s*=\s*([^\s].*)/);
    if (assignmentMatch) {
      const [, key, assignedValueRaw] = assignmentMatch;
      if (sensitiveKeyMatcher.test(key)) {
        const assignedValue = assignedValueRaw.trim();
        const looksQuoted =
          (assignedValue.startsWith('"') && assignedValue.endsWith('"')) ||
          (assignedValue.startsWith("'") && assignedValue.endsWith("'"));
        const unquotedValue = looksQuoted ? assignedValue.slice(1, -1).trim() : assignedValue;
        const isAllowedPlaceholder = placeholderMatcher.test(unquotedValue);
        const looksSuspiciousValue = suspiciousValueMatcher.test(unquotedValue);

        if (!isAllowedPlaceholder && looksSuspiciousValue) {
          violations.push(`${relativePath}:${index + 1} => ${key}=<redacted>`);
        }
      }
    }

    const nextPublicMatch = rawLine.match(nextPublicKeyMatcher);
    if (!nextPublicMatch) continue;

    const hasAssignment = /[:=]/.test(rawLine);
    if (!hasAssignment) continue;

    const valuePart = rawLine.split(/[:=]/).slice(1).join(":").trim();
    const assignedInlineValue = valuePart.replace(/^['"]|['",]$/g, "").trim();
    const assignedToken = assignedInlineValue.split(/\s+/)[0]?.replace(/[`)\],.;]+$/g, "") ?? "";
    const looksLikePlaceholder =
      !assignedToken ||
      /^\*+$/.test(assignedToken) ||
      /^(true|false|null|0|1|on|off|yes|no)$/i.test(assignedToken) ||
      placeholderMatcher.test(assignedToken);

    const isSafeLiteral = safeLiteralMatcher.test(assignedToken) && assignedToken.length <= 32;
    const looksSuspicious = suspiciousValueMatcher.test(assignedToken);

    if (!looksLikePlaceholder && looksSuspicious && !isSafeLiteral) {
      violations.push(`${relativePath}:${index + 1} => ${nextPublicMatch[1]} assignment detected`);
    }
  }
  return violations;
}

function selfTest() {
  const blocked = ["GOMDORY_CONTEXT.md", "docs/PROJECT_STATE.md", "docs/ssot/new.json",
    "scripts/handoff/resume.mjs", "docs/architecture/authority-map.md",
    "docs/repository-handoff-2027.md", "docs/current-state-registry.json",
    "docs/restart-ledger.md", "docs/resume-task-registry.json", "docs/validation-ledger.md",
    "docs/workflow-ssot.md", "docs/MERGE_READINESS_new.md", "project-context.md", "docs/current-handoff.md", "docs/CURRENT_STATE.md",
    "docs/handoff-registry.json", "docs/lifecycle-registry.json",
    "docs/current/handoff.md", "docs/authority/map.json"];
  const allowed = ["AGENTS.md", "docs/INDEX.md", "docs/SSOT_ENV.md", "scripts/ssot/env.inventory.json",
    "docs/product/ORDER_STATUS_CONTRACT.md", "docs/edu/COURSEWARE_STUDENT_RUNTIME_CONTRACT.md",
    "docs/product/Q5_MANUAL_PROVIDER_VERIFICATION_HANDOFF_CONTRACT.md",
    "docs/evidence/horizon/publication/ACTIONS_METADATA_CONTINUATION_CHECKPOINT_20260926.json",
    "docs/history/2026-09-28-validation-results.md", "docs/research/state-machines.md",
    "lib/session/state.ts", "docs/PRODUCTION_RECOVERY_RUNBOOK.md"];
  for (const file of blocked) assert.equal(retiredContextRole(file), true, file);
  for (const file of allowed) assert.equal(retiredContextRole(file), false, file);
  assert.equal(sensitiveAssignments("docs/example.md", "# Current status\nA domain status may be pending.").length, 0);
  assert.equal(sensitiveAssignments("docs/example.md", "API_KEY=<YOUR_KEY>").length, 0);
  const violations = sensitiveAssignments("docs/example.md", "API_KEY=synthetic-secret-canary-value-123456");
  assert.equal(violations.length, 1);
  assert.ok(!violations.join().includes("canary"));
  console.log(`[context-boundary] self-test passed (${blocked.length} denied roles, ${allowed.length} allowed roles, secret redaction).`);
}

function main() {
  if (process.argv.includes("--self-test")) return selfTest();
  // Include task-owned new files locally, and the exact tracked checkout in CI.
  const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" })
    .split("\0").filter(Boolean).filter((file) => fs.existsSync(path.join(root, file)));
  const violations = files.filter(retiredContextRole).map((file) => `${file}: retired repository context role`);
  for (const file of files) {
    if ((file.endsWith(".md") && (file.startsWith("docs/") || !file.includes("/"))) || file === "wrangler.jsonc") {
      violations.push(...sensitiveAssignments(file, fs.readFileSync(path.join(root, file), "utf8")));
    }
  }
  if (violations.length) {
    console.error(`[context-boundary] FAIL\n${violations.map((item) => ` - ${item}`).join("\n")}`);
    process.exitCode = 1;
  } else console.log("[context-boundary] OK: retired context roles absent; document value boundary preserved.");
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
