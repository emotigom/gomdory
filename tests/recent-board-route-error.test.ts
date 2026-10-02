import assert from "node:assert/strict";
import test from "node:test";

import { resolveBoardRouteFailureReason } from "@/app/dashboard/boards/[boardId]/boardRouteError";

test("resolveBoardRouteFailureReason detects forbidden errors", () => {
  assert.equal(resolveBoardRouteFailureReason(new Error("permission denied (403)")), "forbidden");
});

test("resolveBoardRouteFailureReason detects not-found errors", () => {
  assert.equal(resolveBoardRouteFailureReason(new Error("PGRST116: no rows found")), "not-found");
});

test("resolveBoardRouteFailureReason keeps unknown errors as unknown", () => {
  assert.equal(resolveBoardRouteFailureReason(new Error("socket hang up")), "unknown");
});
