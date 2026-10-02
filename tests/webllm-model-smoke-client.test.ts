import test from "node:test";
import assert from "node:assert/strict";
import { getSmokeStageLabel, selectSmallModel } from "@/lib/webllm/webllmModelSmokeClient";

test("large models are skipped when smaller instruct/chat exists", () => {
  const selected = selectSmallModel([
    { model_id: "Llama-3.1-8B-Instruct-q4f16_1" },
    { model_id: "Qwen2.5-0.5B-Instruct-q4f16_1" },
  ]);
  assert.equal(selected, "Qwen2.5-0.5B-Instruct-q4f16_1");
});

test("returns null when only large model candidates exist", () => {
  const selected = selectSmallModel([
    { model_id: "Qwen2.5-7B-Instruct" },
    { model_id: "Llama-3.1-8B-Instruct" },
  ]);
  assert.equal(selected, null);
});

test("smoke stage labels are deterministic", () => {
  assert.equal(getSmokeStageLabel("loading-package"), "패키지 불러오는 중");
  assert.equal(getSmokeStageLabel("selecting-model"), "모델 후보 선택 중");
  assert.equal(getSmokeStageLabel("loading-model"), "모델 다운로드/초기화 중");
  assert.equal(getSmokeStageLabel("running-prompt"), "고정 문장 실행 중");
  assert.equal(getSmokeStageLabel("complete"), "완료");
  assert.equal(getSmokeStageLabel("failed"), "실패");
});
