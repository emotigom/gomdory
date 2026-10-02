import test from "node:test";
import assert from "node:assert/strict";
import { buildAiLearningSpineAssistRequest, requestAiLearningSpineAssist } from "@/lib/edu/courseware/aiLearningSpine/aiLearningSpineAssistClient";

test("assist request payload stays minimal and excludes forbidden fields", () => {
  const payload = buildAiLearningSpineAssistRequest({ taskKind: "verify", lessonId: "L1", selectedPromptChipId: "l1-verify", promptSummary: "요약", verificationContext: "privacy", artifactSummary: "artifact" });
  assert.deepEqual(Object.keys(payload).sort(), ["artifactSummary", "lessonId", "selectedPromptChipId", "studentText", "taskKind", "verificationContext"].sort());
  assert.equal(JSON.stringify(payload).includes("email"), false);
  assert.equal(JSON.stringify(payload).includes("phone"), false);
});

test("assist client normalizes deterministic_safe success", async () => {
  const g = globalThis as unknown as { fetch?: any };
  g.fetch = async () => ({ ok: true, json: async () => ({ ok: true, resultText: "검증 근거를 한 줄 더 써요.", providerMode: "deterministic_safe", fallbackUsed: true, redaction: { applied: true }, safety: { level: "classroom_safe" }, nextStudentAction: "근거 추가" }) });
  const res = await requestAiLearningSpineAssist({ taskKind: "verify", lessonId: 1 });
  assert.equal(res.providerMode, "deterministic_safe");
  assert.equal(res.redactionApplied, true);
  assert.match(res.resultText, /검증/);
});

test("assist client falls back on network failure without throw", async () => {
  const g = globalThis as unknown as { fetch?: any };
  g.fetch = async () => { throw new Error("offline"); };
  const res = await requestAiLearningSpineAssist({ taskKind: "explain", lessonId: 1 });
  assert.equal(res.ok, false);
  assert.equal(res.fallbackUsed, true);
  assert.equal(res.providerMode, "deterministic_safe");
});
