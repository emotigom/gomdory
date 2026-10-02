import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const path of ["app/edu/ai-lab/page.tsx", "lib/webllm/webllmDiagnostics.ts", "lib/webllm/webllmCapability.ts"]) {
  test(`${path} has no @mlc-ai/web-llm import`, () => {
    assert.doesNotMatch(readFileSync(path, "utf8"), /@mlc-ai\/web-llm/);
  });
}

test("client smoke adapter isolates runtime package reference", () => {
  assert.match(readFileSync("lib/webllm/webllmModelSmokeClient.ts", "utf8"), /import\("@mlc-ai\/web-llm"\)/);
});
