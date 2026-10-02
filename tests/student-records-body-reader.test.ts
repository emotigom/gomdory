import assert from "node:assert/strict";
import test from "node:test";
import { contentLengthExceeds, readBodyWithinLimit } from "@/lib/student-records/bodyReader";

test("Content-Length rejects only valid values over the limit", () => {
  assert.equal(contentLengthExceeds(new Headers({ "content-length": "16385" }), 16_384), true);
  assert.equal(contentLengthExceeds(new Headers({ "content-length": "16384" }), 16_384), false);
  assert.equal(contentLengthExceeds(new Headers({ "content-length": "-1" }), 16_384), false);
  assert.equal(contentLengthExceeds(new Headers({ "content-length": "wat" }), 16_384), false);
});

test("bounded reader permits exact UTF-8 boundary and rejects overflow", async () => {
  const exact = new Request("https://example.test", { method: "POST", body: new Uint8Array(16) });
  assert.deepEqual(await readBodyWithinLimit(exact, 16), { ok: true, body: "\0".repeat(16) });
  const over = new Request("https://example.test", { method: "POST", body: new Uint8Array(17) });
  assert.deepEqual(await readBodyWithinLimit(over, 16), { ok: false, tooLarge: true });
});
