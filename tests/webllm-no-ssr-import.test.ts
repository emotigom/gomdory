import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const paths = [
  "app/edu/ai-lab/page.tsx",
  "app/edu/ai-lab/WebLLMLabClient.tsx",
  "lib/webllm/webllmDiagnostics.ts",
  "lib/webllm/webllmCapability.ts",
  "lib/webllm/webllmFlags.ts",
];

for (const path of paths) {
  test(`${path} does not import or reference model runtime packages`, () => {
    const source = readFileSync(resolve(process.cwd(), path), "utf8");
    assert.doesNotMatch(source, /@mlc-ai\/web-llm/);
    assert.doesNotMatch(source, /from\s+["']webllm["']/);
    assert.doesNotMatch(source, /@huggingface\/transformers/);
    assert.doesNotMatch(source, /onnxruntime-web/);
    assert.doesNotMatch(source, /transformers\.js/i);
  });
}
