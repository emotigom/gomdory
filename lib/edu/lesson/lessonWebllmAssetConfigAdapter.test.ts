import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveLessonWebllmAssetHostFromUrl,
  resolveLessonWebllmAssetHosts,
  resolveLessonWebllmSelectionMetadata,
} from "@/lib/edu/lesson/lessonWebllmAssetConfigAdapter";

test("resolveLessonWebllmAssetHostFromUrl extracts host safely", () => {
  assert.equal(resolveLessonWebllmAssetHostFromUrl("https://models.gomdory.com/a/b"), "models.gomdory.com"); // hardcoded-allow exact canonical origin fixture
  assert.equal(resolveLessonWebllmAssetHostFromUrl(""), null);
  assert.equal(resolveLessonWebllmAssetHostFromUrl("not a url"), null);
});

test("resolveLessonWebllmAssetHosts uses configured paths when available", () => {
  const result = resolveLessonWebllmAssetHosts({
    effectiveWebllmEnabled: true,
    preferredModelId: "model-a",
    health: null,
    pathResolver: {
      getPaths: () => ({ modelUrl: "https://unused.example/model/", wasmUrl: "https://unused.example/wasm.wasm" } as never),
      getPathsForModelId: () => ({
        modelUrl: "https://models.gomdory.com/model-a/resolve/main/", // hardcoded-allow exact canonical origin fixture
        wasmUrl: "https://libs.gomdory.com/model-a/model-a.wasm",
      } as never),
    },
  });

  assert.deepEqual(result, {
    modelHost: "models.gomdory.com",
    wasmHost: "libs.gomdory.com",
  });
});

test("resolveLessonWebllmAssetHosts falls back to health payload when path resolution fails", () => {
  const result = resolveLessonWebllmAssetHosts({
    effectiveWebllmEnabled: true,
    preferredModelId: null,
    health: {
      ok: true,
      primary: {
        modelConfigUrl: "https://models.gomdory.com/model-a/resolve/main/mlc-chat-config.json", // hardcoded-allow exact canonical origin fixture
        selectedWasmUrl: "https://libs.gomdory.com/model-a/model-a.wasm",
        wasmCandidateUrls: ["https://libs.gomdory.com/webllm-model.wasm"],
      },
    },
    pathResolver: {
      getPaths: () => {
        throw new Error("env_missing");
      },
      getPathsForModelId: () => {
        throw new Error("env_missing");
      },
    },
  });

  assert.deepEqual(result, {
    modelHost: "models.gomdory.com",
    wasmHost: "libs.gomdory.com",
  });
});

test("resolveLessonWebllmSelectionMetadata returns null fallback when disabled", () => {
  const metadata = resolveLessonWebllmSelectionMetadata({
    effectiveWebllmEnabled: false,
    health: { coach: { modelId: "coach-model" } },
  });

  assert.equal(metadata.fallbackModelId, null);
  assert.equal(metadata.coachModelId, "coach-model");
});
