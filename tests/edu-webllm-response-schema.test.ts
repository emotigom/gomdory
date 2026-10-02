import assert from "node:assert/strict";
import test from "node:test";

import { coachFilesResponseSchema } from "@/lib/edu/llm/responseSchemas";
import {
  allowedCoachFiles,
  validateAllowedCoachFiles,
} from "@/lib/edu/llm/coachFilesValidation";

test("coachFilesResponseSchema parses valid files payloads", () => {
  const payload = {
    type: "files",
    message: "완료",
    files: {
      "index.html": "<html></html>",
      "style.css": "body { color: red; }",
      "script.js": "console.log('ok');",
    },
  };

  const result = coachFilesResponseSchema.parse(payload);
  assert.deepEqual(result, payload);
});

test("coachFilesResponseSchema rejects non-files payloads", () => {
  assert.throws(() => {
    coachFilesResponseSchema.parse({
      type: "message",
      message: "nope",
      files: {},
    });
  });
});

test("validateAllowedCoachFiles rejects unknown files", () => {
  const result = validateAllowedCoachFiles({
    "index.html": "<html></html>",
    "not-allowed.txt": "oops",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.deepEqual(result.invalidFiles, ["not-allowed.txt"]);
  }
});

test("validateAllowedCoachFiles allows configured files", () => {
  const result = validateAllowedCoachFiles({
    [allowedCoachFiles[0]]: "<html></html>",
    [allowedCoachFiles[1]]: "body {}",
  });

  assert.deepEqual(result, { ok: true });
});
