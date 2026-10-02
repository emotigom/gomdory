import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");
const NODE = process.execPath;
const RUNNER = "scripts/qa/q2-b9-e-llm-provider-live.mjs";
const BLOCKED_EXIT_CODE = 2;
const READY_STATUS = "B9-E HARNESS READY — LIVE PRODUCT AUTHORIZATION REQUIRED";
const LOCAL_SUCCESS_STATUS = "B9-E LOCAL-PROVIDER-VERIFIED — READY-TO-PUSH";

function runLive({ apiKey, approval, guestModel, seed }) {
  const reportDir = mkdtempSync(join(tmpdir(), "q2-b9-e-live-"));
  const { OPENAI_API_KEY: inheritedKey, Q2_B9_ALLOW_PAID_LLM_CALL: inheritedApproval, STUDENT_RECORDS_GUEST_MODEL: inheritedModel, ...cleanEnv } = process.env;
  void inheritedKey;
  void inheritedApproval;
  void inheritedModel;
  try {
    if (seed) { mkdirSync(reportDir, { recursive: true }); writeFileSync(join(reportDir, "local-latest.json"), `${JSON.stringify(seed)}\n`); }
    const result = spawnSync(NODE, ["-r", "./tests/setup-node-env.cjs", RUNNER, "--live", "--report-dir", reportDir], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: { ...cleanEnv, ...(apiKey === undefined ? {} : { OPENAI_API_KEY: apiKey }), ...(approval === undefined ? {} : { Q2_B9_ALLOW_PAID_LLM_CALL: approval }), ...(guestModel === undefined ? {} : { STUDENT_RECORDS_GUEST_MODEL: guestModel }) },
    });
    const latest = JSON.parse(readFileSync(join(reportDir, "latest.json"), "utf8"));
    const run = JSON.parse(readFileSync(join(result.stdout.trim().split("\n").at(-1), "report.json"), "utf8"));
    return { result, latest, run };
  } finally {
    rmSync(reportDir, { recursive: true, force: true });
  }
}

function runRunner(mode, reportDir) {
  const { OPENAI_API_KEY: inheritedKey, Q2_B9_ALLOW_PAID_LLM_CALL: inheritedApproval, ...cleanEnv } = process.env;
  void inheritedKey; void inheritedApproval;
  return spawnSync(NODE, ["-r", "./tests/setup-node-env.cjs", RUNNER, `--${mode}`, "--report-dir", reportDir], {
    cwd: process.cwd(), encoding: "utf8", env: { ...cleanEnv, OPENAI_API_KEY: "test-placeholder", Q2_B9_ALLOW_PAID_LLM_CALL: "true" },
  });
}

test("Q2-B9-E live config missing writes evidence before blocked exit", () => {
  const { result, latest, run } = runLive({ approval: "true" });
  assert.equal(result.status, BLOCKED_EXIT_CODE);
  assert.equal(latest.status, "B9-E CONFIG-MISSING");
  assert.equal(run.status, latest.status);
});

test("Q2-B9-E live paid-call approval missing writes evidence before blocked exit", () => {
  const { result, latest, run } = runLive({ apiKey: "test-placeholder", approval: "false" });
  assert.equal(result.status, BLOCKED_EXIT_CODE);
  assert.equal(latest.status, "B9-E PAID-CALL-NOT-APPROVED");
  assert.equal(run.status, latest.status);
});

test("Q2-B9-E live keeps the existing ready status when both gates pass", () => {
  const { result, latest, run } = runLive({ apiKey: "test-placeholder", approval: "true", seed: { mode: "local", status: LOCAL_SUCCESS_STATUS } });
  assert.equal(result.status, 0);
  assert.equal(latest.status, READY_STATUS);
  assert.equal(run.status, READY_STATUS);
  assert.equal(latest.externalProviderCalls, 0);
});

test("Q2-B9-E live allows the exact guest model and blocks non-exact overrides", () => {
  const allowed = runLive({ apiKey: "test-placeholder", approval: "true", guestModel: "gpt-5.4-nano", seed: { mode: "local", status: LOCAL_SUCCESS_STATUS } });
  assert.equal(allowed.result.status, 0);
  assert.equal(allowed.latest.status, READY_STATUS);
  assert.equal(allowed.latest.model.allowed, true);

  for (const guestModel of ["definitely-not-approved-model", "gpt-5.4-nano-preview", "GPT-5.4-NANO"]) {
    const blocked = runLive({ apiKey: "test-placeholder", approval: "true", guestModel, seed: { mode: "local", status: LOCAL_SUCCESS_STATUS } });
    assert.equal(blocked.result.status, BLOCKED_EXIT_CODE);
    assert.equal(blocked.latest.status, "B9-E MODEL-NOT-ALLOWED");
    assert.equal(blocked.latest.model.allowed, false);
    assert.equal(JSON.stringify(blocked.latest).includes(guestModel), false);
  }
});

test("Q2-B9-E live blocks when completed local evidence is missing", () => {
  const { result, latest, run } = runLive({ apiKey: "test-placeholder", approval: "true" });
  assert.equal(result.status, BLOCKED_EXIT_CODE);
  assert.equal(latest.status, "B9-E LOCAL-EVIDENCE-NOT-READY");
  assert.equal(latest.localEvidence.reason, "missing");
  assert.equal(run.localEvidence.reason, "missing");
});

test("Q2-B9-E live blocks invalid local evidence JSON", () => {
  const reportDir = mkdtempSync(join(tmpdir(), "q2-b9-e-invalid-"));
  try {
    writeFileSync(join(reportDir, "local-latest.json"), "not-json\n");
    const { OPENAI_API_KEY: inheritedKey, Q2_B9_ALLOW_PAID_LLM_CALL: inheritedApproval, ...cleanEnv } = process.env;
    void inheritedKey; void inheritedApproval;
    const result = spawnSync(NODE, ["-r", "./tests/setup-node-env.cjs", RUNNER, "--live", "--report-dir", reportDir], { cwd: process.cwd(), encoding: "utf8", env: { ...cleanEnv, OPENAI_API_KEY: "test-placeholder", Q2_B9_ALLOW_PAID_LLM_CALL: "true" } });
    const latest = JSON.parse(readFileSync(join(reportDir, "latest.json"), "utf8"));
    assert.equal(result.status, BLOCKED_EXIT_CODE); assert.equal(latest.localEvidence.reason, "invalid-json");
  } finally { rmSync(reportDir, { recursive: true, force: true }); }
});

test("Q2-B9-E live rejects wrong-mode and incomplete local evidence", () => {
  for (const [mode, status, reason] of [["live", LOCAL_SUCCESS_STATUS, "wrong-mode"], ["local", "B9-E LOCAL-PROVIDER-FAILED", "incomplete-status"]]) {
    const { result, latest } = runLive({ apiKey: "test-placeholder", approval: "true", seed: { mode, status } });
    assert.equal(result.status, BLOCKED_EXIT_CODE); assert.equal(latest.localEvidence.reason, reason);
  }
});

test("Q2-B9-E live does not reuse a live report as local evidence", () => {
  const reportDir = mkdtempSync(join(tmpdir(), "q2-b9-e-live-only-"));
  try {
    writeFileSync(join(reportDir, "latest.json"), JSON.stringify({ mode: "live", status: READY_STATUS }));
    const { OPENAI_API_KEY: inheritedKey, Q2_B9_ALLOW_PAID_LLM_CALL: inheritedApproval, ...cleanEnv } = process.env;
    void inheritedKey; void inheritedApproval;
    const result = spawnSync(NODE, ["-r", "./tests/setup-node-env.cjs", RUNNER, "--live", "--report-dir", reportDir], { cwd: process.cwd(), encoding: "utf8", env: { ...cleanEnv, OPENAI_API_KEY: "test-placeholder", Q2_B9_ALLOW_PAID_LLM_CALL: "true" } });
    const latest = JSON.parse(readFileSync(join(reportDir, "latest.json"), "utf8"));
    assert.equal(result.status, BLOCKED_EXIT_CODE); assert.equal(latest.localEvidence.reason, "missing");
  } finally { rmSync(reportDir, { recursive: true, force: true }); }
});

test("Q2-B9-E live accepts evidence produced by the local runner", () => {
  const reportDir = mkdtempSync(join(tmpdir(), "q2-b9-e-local-"));
  try {
    const local = runRunner("local", reportDir);
    assert.equal(local.status, 0);
    const localEvidencePath = join(reportDir, "local-latest.json");
    const localEvidence = JSON.parse(readFileSync(localEvidencePath, "utf8"));
    assert.equal(localEvidence.mode, "local");
    assert.equal(localEvidence.status, LOCAL_SUCCESS_STATUS);
    const localEvidenceBefore = read(localEvidencePath);
    const live = runRunner("live", reportDir);
    const liveEvidence = JSON.parse(readFileSync(join(reportDir, "latest.json"), "utf8"));
    assert.equal(live.status, 0);
    assert.equal(liveEvidence.status, READY_STATUS);
    assert.equal(liveEvidence.localEvidence.path, localEvidencePath);
    assert.equal(read(localEvidencePath), localEvidenceBefore);
    assert.equal(JSON.parse(read(localEvidencePath)).mode, "local");
    assert.equal(liveEvidence.externalProviderCalls, 0);
  } finally { rmSync(reportDir, { recursive: true, force: true }); }
});

test("Q2-B9-E local runner writes both latest reports and live never overwrites local evidence", () => {
  const reportDir = mkdtempSync(join(tmpdir(), "q2-b9-e-local-preserve-"));
  try {
    const local = runRunner("local", reportDir);
    assert.equal(local.status, 0);
    const localLatest = JSON.parse(readFileSync(join(reportDir, "local-latest.json"), "utf8"));
    const latest = JSON.parse(readFileSync(join(reportDir, "latest.json"), "utf8"));
    assert.equal(localLatest.mode, "local");
    assert.equal(latest.mode, "local");
    assert.equal(localLatest.status, LOCAL_SUCCESS_STATUS);
    assert.equal(latest.status, LOCAL_SUCCESS_STATUS);
    const before = readFileSync(join(reportDir, "local-latest.json"), "utf8");
    const live = runRunner("live", reportDir);
    assert.equal(live.status, 0);
    assert.equal(readFileSync(join(reportDir, "local-latest.json"), "utf8"), before);
    assert.equal(JSON.parse(readFileSync(join(reportDir, "latest.json"), "utf8")).mode, "live");
  } finally { rmSync(reportDir, { recursive: true, force: true }); }
});

test("Q2-B9-E paid-call approval requires exact lowercase true", () => {
  const { result, latest } = runLive({ apiKey: "test-placeholder", approval: "TRUE" });
  assert.equal(result.status, BLOCKED_EXIT_CODE);
  assert.equal(latest.status, "B9-E PAID-CALL-NOT-APPROVED");
});

test("Q2-B9-E fixture is loopback-only, token-gated, and production fail-closed", () => {
  const fixture = read("lib/q2/browser/llmIntegrationFixture.ts");
  assert.match(fixture, /NODE_ENV !== "production"/);
  assert.match(fixture, /x-q2-browser-fixture-authorized/);
  assert.match(read("lib\/q2\/browser\/studentEntryFixture.ts"), /Q2_B9_E_FIXTURE_MODE/);
  assert.match(fixture, /providerCalls \+= 1/);
});

test("Q2-B9-E preserves the guest route validation and isolates only fixture dependencies", () => {
  const route = read("app/api/v1/tools/student-records/generate-guest/route.ts");
  assert.match(route, /parseStudentRecordsGenerateRequest/);
  assert.match(route, /isQ2B9ELlmFixtureRequest/);
  assert.match(route, /fixture \? createQ2B9ELlmFixtureProvider\(\) : createStudentRecordsGuestProvider/);
  assert.match(route, /if \(!fixture\) \{/);
});

test("Q2-B9-E provider boundary retains a single stateless Responses request with timeout", () => {
  const provider = read("lib/student-records/openAiProvider.ts");
  assert.match(provider, /AbortController/);
  assert.match(provider, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(provider, /store: false/);
  assert.equal((provider.match(/fetch\(/g) ?? []).length, 1);
  assert.equal(/retry\s*\(/.test(provider), false);
});
