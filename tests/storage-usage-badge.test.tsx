import assert from "node:assert/strict";
import test from "node:test";

import { resolveStorageUsageBadge } from "@/components/StorageUsageBadge";

test("storage badge uses ok tone below 70%", () => {
  const state = resolveStorageUsageBadge(69);
  assert.equal(state.tone, "ok");
});

test("storage badge uses warn tone at 70%", () => {
  const state = resolveStorageUsageBadge(70);
  assert.equal(state.tone, "warn");
});

test("storage badge uses danger tone at 90%", () => {
  const state = resolveStorageUsageBadge(90);
  assert.equal(state.tone, "danger");
});
