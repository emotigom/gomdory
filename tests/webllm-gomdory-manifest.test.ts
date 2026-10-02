import test from "node:test";
import assert from "node:assert/strict";
import { validateGomdoryManifest } from "@/lib/webllm/webllmGomdoryModelManifest";

test("only https://models.gomdory.com URLs accepted", () => {
  const ok = validateGomdoryManifest({ manifestVersion: 1, generatedAt: "x", models: [{ model_id: "a-1B-instruct", model: "https://models.gomdory.com/a/resolve/main", model_lib: "https://models.gomdory.com/libs/a/a.wasm" }] });
  assert.equal(ok.validModels.length, 1);
  const bad = validateGomdoryManifest({ manifestVersion: 1, generatedAt: "x", models: [{ model_id: "a", model: "http://models.gomdory.com/x", model_lib: "https://evil.com/a.wasm" }] });
  assert.equal(bad.validModels.length, 0);
});

test("disabled and 7B+ rejected", () => {
  const v = validateGomdoryManifest({ manifestVersion: 1, generatedAt: "x", models: [
    { model_id: "x-7B-instruct", model: "https://models.gomdory.com/m", model_lib: "https://models.gomdory.com/l" },
    { model_id: "x-1B-instruct", disabled: true, model: "https://models.gomdory.com/m2", model_lib: "https://models.gomdory.com/l2" },
  ] });
  assert.equal(v.validModels.length, 0);
});
