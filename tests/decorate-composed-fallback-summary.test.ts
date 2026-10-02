import assert from "node:assert/strict";
import test from "node:test";

import { runDecorateFlow } from "@/lib/edu/lesson/runDecorateFlow";
import { createDecorateMetrics } from "@/lib/edu/lesson/decoratePipeline";

test("fallback composed style for CTA prompt emits button style mutation and honest summary", async () => {
  const metrics = createDecorateMetrics({ requestId: "r1" });
  let opKinds: string[] = [];
  let summaryStyle = "";
  let semanticSectionsDetected = false;
  const result = await runDecorateFlow({
    requestId: "r1",
    userPrompt: "CTA 버튼 더 눈에 띄게",
    timeoutMs: 1000,
    metrics,
    maxTokens: 10,
    getCommittedEditorHtmlSSOT: async () => ({ html: "<html><body><main><h1>Title</h1><button>go</button></main></body></html>", snapshotVersion: "s1" }),
    commitStudentHtml: async () => {},
    emitSlotResolve: () => {},
    emitCommitState: () => {},
    onGuardrail: () => {},
    requestServerPlan: async () => ({ ok: false, reason: "x", status: 500 }),
    localPlanEnabled: false,
    startWebLLM: async () => ({ type: "error", kind: "generateJson", error: "disabled" }),
    emitSemanticSectionsDetected: ({ sectionKinds }) => {
      semanticSectionsDetected = sectionKinds.length > 0;
    },
    emitSummaryBuilt: ({ opKinds: kinds, summaryStyle: style }) => {
      opKinds = kinds;
      summaryStyle = style ?? "";
    },
  });
  assert.equal(result.ok, true);
  assert.ok(opKinds.includes("set_button_style") || opKinds.includes("set_accent_style"));
  assert.ok(summaryStyle.length > 0);
  assert.ok(semanticSectionsDetected || summaryStyle.length > 0);
  if (result.ok) {
    assert.match(result.plan.summary, /버튼|강조|대비/);
  }
});

test("partial target fallback still produces style mutation", async () => {
  const metrics = createDecorateMetrics({ requestId: "r2" });
  let partialUsed = false;
  const result = await runDecorateFlow({
    requestId: "r2",
    userPrompt: "카드 느낌을 더 부드럽게",
    timeoutMs: 1000,
    metrics,
    maxTokens: 10,
    getCommittedEditorHtmlSSOT: async () => ({ html: "<html><body><main><section><p>x</p></section></main></body></html>", snapshotVersion: "s1" }),
    commitStudentHtml: async () => {},
    emitSlotResolve: () => {},
    emitCommitState: () => {},
    onGuardrail: () => {},
    requestServerPlan: async () => ({ ok: false, reason: "x", status: 500 }),
    localPlanEnabled: false,
    startWebLLM: async () => ({ type: "error", kind: "generateJson", error: "disabled" }),
    emitStyleFallbackPartialTargetUsed: () => {
      partialUsed = true;
    },
  });
  assert.equal(result.ok, true);
  assert.ok(partialUsed || result.plan.ops.length > 0);
});

test("semantic-aware summary mentions hero/headline context", async () => {
  const metrics = createDecorateMetrics({ requestId: "r3" });
  let summaryStyle = "";
  const result = await runDecorateFlow({
    requestId: "r3",
    userPrompt: "제목을 좀 더 강조해줘",
    timeoutMs: 1000,
    metrics,
    maxTokens: 10,
    getCommittedEditorHtmlSSOT: async () => ({ html: "<html><body><main><section class='hero'><h1>Title</h1></section></main></body></html>", snapshotVersion: "s1" }),
    commitStudentHtml: async () => {},
    emitSlotResolve: () => {},
    emitCommitState: () => {},
    onGuardrail: () => {},
    requestServerPlan: async () => ({ ok: false, reason: "x", status: 500 }),
    localPlanEnabled: false,
    startWebLLM: async () => ({ type: "error", kind: "generateJson", error: "disabled" }),
    emitSummaryBuilt: ({ summaryStyle: style }) => {
      summaryStyle = style ?? "";
    },
  });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.match(result.plan.summary, /첫 화면|제목/);
  }
  assert.ok(summaryStyle.length > 0);
});
