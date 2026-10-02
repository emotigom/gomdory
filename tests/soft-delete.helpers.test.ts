import assert from "node:assert/strict";
import test from "node:test";

import { buildRestorePayload, buildSoftDeletePayload, SOFT_DELETE_DB_COLUMNS } from "@/lib/db/softDelete";

test("soft delete helpers map camelCase keys to DB payload", () => {
  const nowIso = "2026-01-01T00:00:00.000Z";
  const payload = buildSoftDeletePayload({ nowIso, deletedBy: "u1" }) as Record<string, unknown>;
  assert.equal(payload.deleted_at, nowIso);
  assert.equal(payload.updated_at, nowIso);
  assert.equal(payload.deleted_by, "u1");
  assert.equal(SOFT_DELETE_DB_COLUMNS.deletedAt, "deleted_at");
});

test("restore payload clears delete flags", () => {
  const nowIso = "2026-01-01T00:00:00.000Z";
  const payload = buildRestorePayload(nowIso) as Record<string, unknown>;
  assert.equal(payload.deleted_at, null);
  assert.equal(payload.deleted_by, null);
  assert.equal(payload.delete_reason, null);
  assert.equal(payload.updated_at, nowIso);
});
