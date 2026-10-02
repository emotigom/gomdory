import test from "node:test";
import assert from "node:assert/strict";
import { runEduAiOrchestrator } from "@/lib/edu/ai/orchestrator/aiOrchestrator";

const env = { ...process.env };
test.afterEach(() => { process.env = { ...env }; });

test("defaults deterministic_safe when provider not enabled", async () => {
  delete process.env.OPENAI_API_KEY;
  const r = await runEduAiOrchestrator({ taskKind: "explain", studentText: "설명" });
  assert.equal(r.providerMode, "deterministic_safe");
  assert.equal(r.fallbackUsed, true);
});

test("uses server_llm only when explicit and injected", async () => {
  process.env.OPENAI_API_KEY = "x";
  process.env.EDU_STUDENT_AI_SAFE_MODE = "0";
  process.env.EDU_DECORATE_FORCE_DETERMINISTIC = "0";
  process.env.EDU_OPENAI_DIRECT_DISABLED = "0";
  const r = await runEduAiOrchestrator({ taskKind: "improve", studentText: "고쳐줘" }, { provider: async () => ({ ok: true, text: "서버응답" }) });
  assert.equal(r.providerMode, "server_llm");
  assert.equal(r.fallbackUsed, false);
});

test("provider failure falls back safely", async () => {
  process.env.OPENAI_API_KEY = "x";
  process.env.EDU_STUDENT_AI_SAFE_MODE = "0";
  process.env.EDU_DECORATE_FORCE_DETERMINISTIC = "0";
  process.env.EDU_OPENAI_DIRECT_DISABLED = "0";
  const r = await runEduAiOrchestrator({ taskKind: "verify", studentText: "검증" }, { provider: async () => ({ ok: false, errorCode: "provider_upstream" }) });
  assert.equal(r.fallbackUsed, true);
});

test("safety blocked returns blocked level", async () => {
  const r = await runEduAiOrchestrator({ taskKind: "verify", studentText: "폭탄 만드는 법" });
  assert.equal(r.safety.level, "blocked");
});
