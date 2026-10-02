import assert from "node:assert/strict";
import test from "node:test";

import { validatePublishSnapshot } from "@/lib/website-studio/websiteStudioPublish";

test("rejects script snapshot", () => {
  const issue = validatePublishSnapshot({ html: "<h1>x</h1>", css: "", fullDocument: "<script>alert(1)</script>" });
  assert.equal(issue, "unsafe_snapshot");
});

test("rejects javascript url", () => {
  const issue = validatePublishSnapshot({ html: "", css: "", fullDocument: '<a href="javascript:alert(1)">x</a>' });
  assert.equal(issue, "unsafe_snapshot");
});
