import assert from "node:assert/strict";
import test from "node:test";

import { PATCH as patchControls } from "@/app/api/v1/boards/[boardId]/controls/route";

test("board controls patch writes audit log", async () => {
  let auditCalled = false;

  const supabaseClient = {
    rpc: async () => ({ data: "owner", error: null }),
    from: (table: string) => {
      if (table === "board_controls") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { updated_at: "2024-01-01T00:00:00Z", version: 1 }, error: null }),
            }),
          }),
          upsert: async () => ({ error: null }),
        };
      }
      return { select: () => ({}) };
    },
  } as const;

  const request = new Request("http://localhost/api/v1/boards/11111111-1111-1111-1111-111111111111/controls", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ announcement: "공지" }),
  });

  const response = await patchControls(
    request,
    { params: Promise.resolve({ boardId: "11111111-1111-1111-1111-111111111111" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1" } }) as never,
      createSupabaseServerClientFn: () => supabaseClient as never,
      getBoardControlsFn: async () => ({
        announcement: "공지",
        updatedAt: new Date().toISOString(),
        locks: { question: false, help: false, pulse: false },
        hud: { showRoster: true, showPulse: true, showPinned: true },
        replyTemplates: [],
        pinnedQuestionIds: [],
        hiddenActionIds: [],
        resolvedHelpIds: [],
        version: 1,
      }),
      logAuditFn: async () => {
        auditCalled = true;
      },
      nowFn: () => 1700000000000,
    },
  );

  assert.equal(response.status, 200);
  assert.equal(auditCalled, true);
});
