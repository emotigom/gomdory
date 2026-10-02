import assert from "node:assert/strict";
import test from "node:test";

import { requestKickstart, shouldTriggerKickstart } from "@/app/dashboard/kickstart";
import { kickstartOnce } from "@/lib/data/onboarding.server";

test("kickstartOnce only creates once", async () => {
  let claimed = false;
  let createdCount = 0;

  const deps = {
    claimKickstart: async () => {
      if (claimed) return false;
      claimed = true;
      return true;
    },
    finalizeKickstart: async () => {},
    rollbackKickstart: async () => {},
    ensureShare: async () => ({
      id: "board-1",
      owner_id: "user-1",
      title: "첫 수업 보드",
      description: null,
      board_view_type: "grid" as const,
      share_code: "share01",
      share_enabled: true,
      share_updated_at: new Date().toISOString(),
      share_write_enabled: true,
      share_write_updated_at: new Date().toISOString(),
      class_state: "idle" as const,
      class_notice: null,
      class_updated_at: new Date().toISOString(),
      rules_text: null,
      rules_updated_at: new Date().toISOString(),
    }),
    createBoard: async () => {
      createdCount += 1;
      return {
        id: "board-1",
        title: "첫 수업 보드",
        description: null,
        created_at: new Date().toISOString(),
        board_view_type: "grid" as const,
        share_code: null,
        share_enabled: false,
        share_updated_at: new Date().toISOString(),
        share_write_enabled: false,
        share_write_updated_at: new Date().toISOString(),
        class_state: "idle" as const,
        class_notice: null,
        class_updated_at: new Date().toISOString(),
        rules_text: null,
        rules_updated_at: new Date().toISOString(),
      };
    },
    now: () => new Date().toISOString(),
  };

  const first = await kickstartOnce("user-1", deps);
  const second = await kickstartOnce("user-1", deps);

  assert.equal(first.created, true);
  assert.equal(first.skipped, false);
  assert.equal(second.created, false);
  assert.equal(second.skipped, true);
  assert.equal(createdCount, 1);
});

test("shouldTriggerKickstart allows new-user hint with zero boards", () => {
  const shouldTrigger = shouldTriggerKickstart({
    boardCount: 0,
    loadState: "ready",
    hasTriggered: false,
    shouldAutoOpenChecklist: true,
  });

  assert.equal(shouldTrigger, true);
});

test("requestKickstart returns payload for ok response", async () => {
  const fetchMock = async () =>
    new Response(JSON.stringify({ ok: true, created: true, boardId: "board-1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  const payload = await requestKickstart(fetchMock);

  assert.equal(payload.ok, true);
  assert.equal("created" in payload ? payload.created : false, true);
});
