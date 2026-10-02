import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("student root join form keeps Turnstile disabled until submit intent", () => {
  const source = readFileSync("app/_components/JoinByCode.tsx", "utf8");

  assert.match(source, /const \[isTurnstileEnabled, setIsTurnstileEnabled\] = useState\(false\)/);
  assert.match(source, /const \[turnstileExecutionKey, setTurnstileExecutionKey\] = useState\(0\)/);
  assert.match(source, /const canAttemptSubmit =\s*isShareCodeValid && !isSubmitting && !isChallengePending/);
  assert.match(source, /disabled=\{!canAttemptSubmit\}/);
  assert.match(source, /if \(!turnstileToken\) \{/);
  assert.match(source, /setPendingSubmit\(\{ name: submitName, code: submitCode \}\)/);
  assert.match(source, /setIsChallengePending\(true\)/);
  assert.match(source, /setTurnstileExecutionKey\(\(current\) => current \+ 1\)/);
  assert.match(source, /setIsTurnstileEnabled\(true\)/);
  assert.match(source, /executionKey=\{turnstileExecutionKey\}/);
  assert.doesNotMatch(source, /Boolean\(turnstileToken\)\s*&&\s*!isSubmitting/);
});

test("pending submit auto-continues when token arrives", () => {
  const source = readFileSync("app/_components/JoinByCode.tsx", "utf8");

  assert.match(source, /if \(!pendingSubmit \|\| !turnstileToken \|\| isSubmitting\) \{/);
  assert.match(source, /void submitJoin\(\{/);
  assert.match(source, /submitName: pendingSubmit\.name/);
  assert.match(source, /submitCode: pendingSubmit\.code/);
});

test("turnstile widget supports explicit enable gate and auto execute", () => {
  const source = readFileSync("app/_components/TurnstileWidget.tsx", "utf8");

  assert.match(source, /enabled\?: boolean/);
  assert.match(source, /executionKey\?: number \| string/);
  assert.match(source, /if \(!enabled\) \{/);
  assert.match(source, /\{enabled \? <div ref=\{containerRef\} \/> : null\}/);
  assert.match(source, /statusRef\.current === "executing"/);
  assert.match(source, /if \(widgetIdRef\.current\) \{/);
  assert.match(source, /window\.turnstile\.reset\?\.\(id\)/);
  assert.match(source, /window\.turnstile\.execute\(id\)/);
  assert.match(source, /\}, \[enabled, executionKey, executeWidget\]\)/);
  assert.match(source, /onError\?\.\(\)/);
  assert.match(source, /onExpire\?\.\(\)/);
});
