import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateWebLLMEnablement,
  getEduWebLLMEnableFlag,
  getEduWebLLMHardDisableFlag,
  getEduWebLLMInitTimeoutMs,
  getEduWebLLMLastGoodTtlMs,
  normalizeBoolean,
} from "@/lib/edu/llm/webllmFeatureFlags";

const withEnv = (patch: Record<string, string | undefined>, run: () => void) => {
  const prev = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(patch)) {
    prev.set(key, process.env[key]);
    if (value == null) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    run();
  } finally {
    for (const [key, value] of prev.entries()) {
      if (value == null) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
};

test("webllm gate blocks when global feature flag disabled", () => {
  withEnv(
    {
      NEXT_PUBLIC_EDU_WEBLLM_ENABLE: "0",
    },
    () => {
      const decision = evaluateWebLLMEnablement({ featureFlags: { webllmEnabled: true } });
      assert.equal(decision.enabled, false);
      assert.equal(decision.reasonCode, "flag_disabled");
    },
  );
});

test("webllm gate blocks when user toggle is off", () => {
  withEnv(
    {
      NEXT_PUBLIC_EDU_WEBLLM_ENABLE: "1",
    },
    () => {
      const decision = evaluateWebLLMEnablement({ featureFlags: { webllmEnabled: false } });
      assert.equal(decision.enabled, false);
      assert.equal(decision.reasonCode, "user_disabled");
    },
  );
});

test("webllm gate allows enabled users", () => {
  withEnv(
    {
      NEXT_PUBLIC_EDU_WEBLLM_ENABLE: "1",
    },
    () => {
      const decision = evaluateWebLLMEnablement({ featureFlags: { webllmEnabled: true } });
      assert.equal(decision.enabled, true);
      assert.equal(decision.reasonCode, "enabled");
    },
  );
});

test("webllm timeout/ttl flags read defaults and custom values", () => {
  withEnv(
    {
      NEXT_PUBLIC_EDU_WEBLLM_INIT_TIMEOUT_MS: undefined,
      NEXT_PUBLIC_EDU_WEBLLM_LASTGOOD_TTL_MS: undefined,
    },
    () => {
      assert.equal(getEduWebLLMInitTimeoutMs(), 45_000);
      assert.equal(getEduWebLLMLastGoodTtlMs(), 7 * 24 * 60 * 60 * 1000);
    },
  );

  withEnv(
    {
      NEXT_PUBLIC_EDU_WEBLLM_INIT_TIMEOUT_MS: "70000",
      NEXT_PUBLIC_EDU_WEBLLM_LASTGOOD_TTL_MS: "120000",
    },
    () => {
      assert.equal(getEduWebLLMInitTimeoutMs(), 70_000);
      assert.equal(getEduWebLLMLastGoodTtlMs(), 120_000);
    },
  );
});

test("normalizeBoolean supports boolean/number/string aliases", () => {
  assert.equal(normalizeBoolean(true, false), true);
  assert.equal(normalizeBoolean(false, true), false);
  assert.equal(normalizeBoolean(1, false), true);
  assert.equal(normalizeBoolean(0, true), false);
  assert.equal(normalizeBoolean("yes", false), true);
  assert.equal(normalizeBoolean("off", true), false);
  assert.equal(normalizeBoolean("unknown", true), true);
  assert.equal(normalizeBoolean(2, false), false);
});

test("webllm enable env defaults to true and supports string booleans", () => {
  withEnv({ NEXT_PUBLIC_EDU_WEBLLM_ENABLE: undefined }, () => {
    assert.equal(getEduWebLLMEnableFlag(), true);
  });

  withEnv({ NEXT_PUBLIC_EDU_WEBLLM_ENABLE: "false" }, () => {
    assert.equal(getEduWebLLMEnableFlag(), false);
  });

  withEnv({ NEXT_PUBLIC_EDU_WEBLLM_ENABLE: "1" }, () => {
    assert.equal(getEduWebLLMEnableFlag(), true);
  });
});


test("hard disable defaults to false for undefined/false/0/no", () => {
  withEnv({ EDU_WEBLLM_HARD_DISABLE: undefined, NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE: undefined }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), false);
  });

  withEnv({ EDU_WEBLLM_HARD_DISABLE: "false" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), false);
  });

  withEnv({ EDU_WEBLLM_HARD_DISABLE: "0" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), false);
  });

  withEnv({ EDU_WEBLLM_HARD_DISABLE: "no" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), false);
  });
});

test("hard disable only enables for true/1/yes", () => {
  withEnv({ EDU_WEBLLM_HARD_DISABLE: "true" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), true);
  });
  withEnv({ EDU_WEBLLM_HARD_DISABLE: "1" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), true);
  });
  withEnv({ EDU_WEBLLM_HARD_DISABLE: "yes" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), true);
  });
  withEnv({ EDU_WEBLLM_HARD_DISABLE: "on" }, () => {
    assert.equal(getEduWebLLMHardDisableFlag(), false);
  });
});
