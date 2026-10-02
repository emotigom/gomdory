#!/usr/bin/env node

import {
  CLOUDFLARE_DASHBOARD_PATH,
  REQUIRED_WEBLLM_NON_EMPTY_KEYS,
} from "../ssot/env-inventory.mjs";

const parseBool = (value, fallback) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
    return fallback;
  }
  if (value == null || value === "") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
};

const dashboardPath = `${CLOUDFLARE_DASHBOARD_PATH} (Build Variables + Runtime Variables for NEXT_PUBLIC_EDU_WEBLLM_*)`;
const acceptedBooleanFormats = ["1", "0", "true", "false"];
const parseableBooleanLiterals = [...acceptedBooleanFormats, "yes", "no", "on", "off"];

const booleanKeys = [
  "NEXT_PUBLIC_EDU_WEBLLM_ENABLE",
  "WEBLLM_ENABLED",
  "NEXT_PUBLIC_EDU_WEBLLM_LABS",
  "NEXT_PUBLIC_EDU_WEBLLM_PREFETCH",
  "NEXT_PUBLIC_EDU_WEBLLM_AUTO_TIER",
  "EDU_WEBLLM_HARD_DISABLE",
  "NEXT_PUBLIC_EDU_WEBLLM_HARD_DISABLE",
];

const readRaw = (key) => {
  const value = process.env[key];
  return typeof value === "string" ? value : undefined;
};

const trimOrEmpty = (value) => (typeof value === "string" ? value.trim() : "");

const keysPresentButEmpty = REQUIRED_WEBLLM_NON_EMPTY_KEYS.filter((key) => {
  const raw = readRaw(key);
  return raw !== undefined && trimOrEmpty(raw).length === 0;
});

const disallowedInternalPrefix = "/edu-webllm-models";
const rewriteSensitiveBaseKeys = [
  "NEXT_PUBLIC_EDU_WEBLLM_MODEL_BASE",
  "NEXT_PUBLIC_EDU_WEBLLM_LIB_BASE",
];

const basePrefixViolations = rewriteSensitiveBaseKeys
  .map((key) => ({ key, value: trimOrEmpty(readRaw(key)) }))
  .filter((entry) => entry.value.includes(disallowedInternalPrefix));

const invalidBooleanKeys = booleanKeys
  .filter((key) => readRaw(key) !== undefined)
  .filter((key) => {
    const raw = readRaw(key);
    const normalized = trimOrEmpty(raw).toLowerCase();
    if (!normalized) return false;
    const parsed = parseBool(raw, false);
    const parseable = parseableBooleanLiterals.includes(normalized) || parsed === true || parsed === false;
    if (!parseable) return true;
    return !acceptedBooleanFormats.includes(normalized);
  });

if (!keysPresentButEmpty.length && !invalidBooleanKeys.length && !basePrefixViolations.length) {
  console.log("[predeploy:webllm-env] OK: required non-empty keys and boolean toggles look valid.");
  process.exit(0);
}

console.error("[predeploy:webllm-env] FAIL: WebLLM env validation failed.");
if (keysPresentButEmpty.length) {
  console.error(
    `[predeploy:webllm-env] Keys present but empty (must be non-empty in both Cloudflare Build Variables and Runtime Variables): ${keysPresentButEmpty.join(", ")}`,
  );
}
if (invalidBooleanKeys.length) {
  console.error(
    `[predeploy:webllm-env] Boolean toggle format invalid. Normalize values to ${acceptedBooleanFormats.join("/")} (runtime parsing still accepts yes/no/on/off).`,
  );
  for (const key of invalidBooleanKeys) {
    console.error(`[predeploy:webllm-env] - ${key}=${JSON.stringify(readRaw(key))}`);
  }
}
if (basePrefixViolations.length) {
  console.error(
    `[predeploy:webllm-env] Internal storage prefix detected (${disallowedInternalPrefix}). models.gomdory.com is already rewritten to bucket root; keep MODEL_BASE/LIB_BASE at domain-root paths only.`,
  );
  for (const { key, value } of basePrefixViolations) {
    console.error(`[predeploy:webllm-env] - ${key}=${JSON.stringify(value)}`);
  }
}

console.error(`[predeploy:webllm-env] Fix in ${dashboardPath}`);
console.error(`[predeploy:webllm-env] Required WebLLM non-empty keys: ${REQUIRED_WEBLLM_NON_EMPTY_KEYS.join(", ")}`);
process.exit(1);
