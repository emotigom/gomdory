import assert from "node:assert/strict";
import test from "node:test";

import {
  CLASS_CODE_CHARSET,
  generateClassCode,
  isValidClassCode,
  withClassCodeRetries,
} from "@/lib/data/classes";

test("class code generation uses allowed charset and length", () => {
  const code = generateClassCode(6);
  assert.equal(code.length, 6);
  assert.equal([...code].every((char) => CLASS_CODE_CHARSET.includes(char)), true);
  assert.equal(isValidClassCode(code), true);
});

test("class code generation retries on collisions", async () => {
  const codes = ["ABCD", "EFGH"];
  let index = 0;
  let attempts = 0;

  const result = await withClassCodeRetries({
    generate: () => codes[index++] ?? "WXYZ",
    create: async (code) => {
      attempts += 1;
      if (code === "ABCD") {
        const error = { code: "23505" };
        throw error;
      }
      return code;
    },
  });

  assert.equal(result, "EFGH");
  assert.equal(attempts, 2);
});
