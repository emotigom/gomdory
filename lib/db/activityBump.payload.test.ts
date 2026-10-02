import assert from "node:assert/strict";
import test from "node:test";

import { buildActivityBumpPayload } from "@/lib/db/activityBump";

test("buildActivityBumpPayload sets computed column key and value", () => {
  const nowIso = "2026-02-18T00:00:00.000Z";
  const payload = buildActivityBumpPayload("class_updated_at", nowIso);

  assert.equal(Object.prototype.hasOwnProperty.call(payload, "class_updated_at"), true);
  assert.equal(payload.class_updated_at, nowIso);
  assert.deepEqual(Object.keys(payload), ["class_updated_at"]);
});
