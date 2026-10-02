import assert from "node:assert/strict";
import test from "node:test";

import EduCodingStudioPage from "@/app/edu/coding/page";

test("edu coding page returns a renderable element", () => {
  const element = EduCodingStudioPage();
  assert.ok(element);
});
