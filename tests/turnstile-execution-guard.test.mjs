import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("app/_components/TurnstileWidget.tsx", "utf8");

test("Turnstile explicit rendering waits for one intentional execute call", () => {
  assert.match(source, /execution\?: "render" \| "execute"/);
  assert.match(source, /execution: "execute"/);
  assert.match(source, /widgetIdRef\.current = id;\s*executeWidget\(id\)/);
});

test("Turnstile custom error handling suppresses duplicate provider warnings", () => {
  assert.match(source, /"error-callback"\?: \(errorCode\?: string\) => boolean \| void/);
  assert.match(source, /callbacksRef\.current\.onError\?\.\(\);\s*return true;/);
});
