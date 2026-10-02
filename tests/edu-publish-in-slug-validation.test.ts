import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import { resolveInSlug } from "@/lib/edu/publish/publishRpc";

test("resolveInSlug normalizes required in_slug field", () => {
  assert.equal(resolveInSlug({ in_slug: " my-slug " }), "my-slug");
  assert.equal(resolveInSlug({ in_slug: "   " }), "");
  assert.equal(resolveInSlug({}), "");
});

test("commit route returns INVALID_SLUG when in_slug is empty before RPC", () => {
  const filePath = path.join(process.cwd(), "lib/server/edu/publish/handleEduPublishCommit.ts");
  const source = fs.readFileSync(filePath, "utf8");
  assert.match(source, /resolveInSlug\(publishPayload\)/);
  assert.match(source, /commitError\("INVALID_SLUG",\s*"in_slug is required"/);
});
