import test from "node:test";
import assert from "node:assert/strict";

import { isWebLLMLabEnabled, isWebLLMModelSmokeEnabled } from "@/lib/webllm/webllmFlags";

const LAB_ENV_KEY = "NEXT_PUBLIC_WEBLLM_LAB_V1";
const SMOKE_ENV_KEY = "NEXT_PUBLIC_WEBLLM_MODEL_SMOKE_V1";

function withFlags(lab: string | undefined, smoke: string | undefined, run: () => void) {
  const prevLab = process.env[LAB_ENV_KEY];
  const prevSmoke = process.env[SMOKE_ENV_KEY];

  if (lab === undefined) delete process.env[LAB_ENV_KEY];
  else process.env[LAB_ENV_KEY] = lab;

  if (smoke === undefined) delete process.env[SMOKE_ENV_KEY];
  else process.env[SMOKE_ENV_KEY] = smoke;

  try {
    run();
  } finally {
    if (prevLab === undefined) delete process.env[LAB_ENV_KEY];
    else process.env[LAB_ENV_KEY] = prevLab;

    if (prevSmoke === undefined) delete process.env[SMOKE_ENV_KEY];
    else process.env[SMOKE_ENV_KEY] = prevSmoke;
  }
}

test("webllm flags are false by default", () => {
  withFlags(undefined, undefined, () => {
    assert.equal(isWebLLMLabEnabled(), false);
    assert.equal(isWebLLMModelSmokeEnabled(), false);
  });
});

test("model smoke cannot be usable unless lab is enabled", () => {
  withFlags(undefined, "enabled", () => {
    assert.equal(isWebLLMModelSmokeEnabled(), false);
  });
});

test("accepted truthy values are deterministic", () => {
  for (const value of ["1", "true", "enabled", "TRUE", " Enabled "]) {
    withFlags(value, value, () => {
      assert.equal(isWebLLMLabEnabled(), true);
      assert.equal(isWebLLMModelSmokeEnabled(), true);
    });
  }
});

test("random values do not enable flags", () => {
  for (const value of ["yes", "on", "2", "", "0", "false"]) {
    withFlags(value, value, () => {
      assert.equal(isWebLLMLabEnabled(), false);
      assert.equal(isWebLLMModelSmokeEnabled(), false);
    });
  }
});
