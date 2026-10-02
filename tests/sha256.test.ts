import assert from "node:assert/strict";
import test from "node:test";

import { sha256Hex } from "@/lib/crypto/sha256";

const encoder = new TextEncoder();

test("sha256Hex computes stable digest", async () => {
  const buffer = encoder.encode("abc").buffer;
  const hex = await sha256Hex(buffer);
  assert.equal(hex, "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});
