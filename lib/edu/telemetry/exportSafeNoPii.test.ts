import assert from "node:assert/strict";
import test from "node:test";
import { createEduMetricsBuffer } from "./eduSessionMetrics";

type UnknownRecord = Record<string, unknown>;

const FORBIDDEN_KEY_SUBSTRINGS = [
  "prompt",
  "message",
  "content",
  "text",
  "input",
  "output",
  "completion",
  "response",
];

const ALLOWED_FORBIDDEN_KEYS = new Set<string>(["errorCount"]);
const SAFE_INPUT_STEP_PATH = ["summary", "step", "INPUT"];
const SAFE_INPUT_STEP_KEYS = new Set(["ok", "fail"]);

const countNewlines = (value: string) => (value.match(/\n/g) ?? []).length;

const isSafeInputStepSummary = (value: unknown) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entries = Object.entries(value as UnknownRecord);
  return (
    entries.length === SAFE_INPUT_STEP_KEYS.size &&
    entries.every(([key, count]) =>
      SAFE_INPUT_STEP_KEYS.has(key) && typeof count === "number" && Number.isFinite(count) && Number.isInteger(count) && count >= 0,
    )
  );
};

const isSafeInputStepPath = (path: string[]) =>
  path.length === SAFE_INPUT_STEP_PATH.length && path.every((segment, index) => segment === SAFE_INPUT_STEP_PATH[index]);

const validateNoPii = (value: unknown, path: string[] = []) => {
  if (typeof value === "string") {
    assert.ok(value.length < 200, `String too long at ${path.join(".") || "root"}`);
    assert.ok(
      countNewlines(value) < 3,
      `String has too many newlines at ${path.join(".") || "root"}`,
    );
    assert.doesNotMatch(value, /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/, `Email-shaped value at ${path.join(".") || "root"}`);
    assert.doesNotMatch(value, /(?:\+?\d{1,3}[ -]?)?(?:\d{2,4}[ -]?){2}\d{3,4}/, `Phone-shaped value at ${path.join(".") || "root"}`);
    assert.doesNotMatch(value, /\b[A-Z][a-z]+ [A-Z][a-z]+\b/, `Name-shaped value at ${path.join(".") || "root"}`);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateNoPii(entry, [...path, String(index)]));
    return;
  }

  if (!value || typeof value !== "object") {
    return;
  }

  if (isSafeInputStepPath(path)) {
    assert.ok(isSafeInputStepSummary(value), "summary.step.INPUT must contain only non-negative integer ok/fail counts");
    return;
  }

  for (const [key, entry] of Object.entries(value as UnknownRecord)) {
    const entryPath = [...path, key];
    if (isSafeInputStepPath(entryPath)) {
      assert.ok(isSafeInputStepSummary(entry), "summary.step.INPUT must contain only non-negative integer ok/fail counts");
      continue;
    }
    const lowerKey = key.toLowerCase();
    const hasForbidden = FORBIDDEN_KEY_SUBSTRINGS.some((substr) => lowerKey.includes(substr));
    if (hasForbidden && !ALLOWED_FORBIDDEN_KEYS.has(key)) {
      assert.fail(`Forbidden key detected at ${entryPath.join(".")}`);
    }
    validateNoPii(entry, entryPath);
  }
};

test("exportSafe payload blocks PII-shaped keys/values", () => {
  const buffer = createEduMetricsBuffer(5);
  buffer.add({ t: 1, type: "STEP", step: "INPUT", ok: true });
  buffer.add({ t: 2, type: "WARN", code: "KANA" });
  buffer.add({ t: 3, type: "HARDFAIL", code: "SCHEMA_INVALID" });
  buffer.add({ t: 4, type: "LESSON", lessonId: "P2", locked: false });
  buffer.add({ t: 5, type: "ACTION", name: "EXPORT" });

  const payload = buffer.exportSafe({
    buildId: "build-123",
    currentStepId: "chat",
    templateKey: "template-01",
    panelState: "READY_TO_GENERATE",
    recentEvents: [
      { ts: 10, type: "STEP", meta: { codeHash: "abc123" } },
      { ts: 12, type: "WARN", meta: { codeHash: "def456" } },
    ],
  });

  validateNoPii(payload);
});

test("exportSafe payload permits only the fixed INPUT aggregate schema", () => {
  validateNoPii({ summary: { step: { INPUT: { ok: 1, fail: 0 } } } });
  assert.throws(() => validateNoPii({ summary: { step: { INPUT: { raw: "student@example.com" } } } }));
  assert.throws(() => validateNoPii({ summary: { step: { INPUT: { text: "make a game about my school" } } } }));
  assert.throws(() => validateNoPii({ summary: { step: { INPUT: { ok: "1", fail: 0 } } } }));
  assert.throws(() => validateNoPii({ summary: { step: { INPUT: { ok: 1, fail: { nested: 0 } } } } }));
});

test("exportSafe payload blocks PII-shaped keys and free-text values", () => {
  for (const payload of [
    { input: "student@example.com" },
    { meta: { rawInput: "my private prompt" } },
    { meta: { userInput: "my private prompt" } },
    { meta: { inputText: "my private prompt" } },
    { prompt: "make a game about my school" },
    { message: "hello from a student" },
    { content: "Jane Doe" },
    { value: "student@example.com" },
    { value: "010-1234-5678" },
    { value: "Jane Doe" },
  ]) {
    assert.throws(() => validateNoPii(payload));
  }
});
