import assert from "node:assert/strict";
import test from "node:test";

import { GET as getControls, PATCH as patchControls } from "@/app/api/v1/boards/[boardId]/controls/route";
import { buildDefaultControls } from "@/lib/data/boardControls";
import { DEFAULT_HUD, DEFAULT_LOCKS } from "@/lib/controls/boardControlsDefaults";

const boardId = "11111111-1111-1111-1111-111111111111";

test("board controls GET returns defaults when missing", async () => {
  let receivedOptions: { createIfMissing?: boolean } | undefined;
  const request = new Request(`http://localhost/api/v1/boards/${boardId}/controls`);

  const response = await getControls(
    request,
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
      createSupabaseServerClientFn: () =>
        ({
          rpc: async () => ({ data: "owner", error: null }),
        }) as never,
      getBoardControlsFn: async (id, options) => {
        receivedOptions = options;
        return buildDefaultControls(id);
      },
    },
  );

  const payload = (await response.json()) as { ok?: boolean; controls?: ReturnType<typeof buildDefaultControls> };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(receivedOptions?.createIfMissing, true);
  assert.deepEqual(payload.controls?.locks, DEFAULT_LOCKS);
  assert.deepEqual(payload.controls?.hud, DEFAULT_HUD);
});

test("board controls PATCH merges partial locks and hud", async () => {
  let upsertPayload: Record<string, unknown> | null = null;

  const supabaseClient = {
    rpc: async () => ({ data: "owner", error: null }),
    from: (table: string) => {
      if (table === "board_controls") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  updated_at: "2024-01-01T00:00:00Z",
                  version: 1,
                  locks: { question: false, help: false, pulse: false },
                  hud: { showRoster: true, showPulse: true, showPinned: true },
                  reply_templates: [],
                },
                error: null,
              }),
            }),
          }),
          upsert: async (payload: Record<string, unknown>) => {
            upsertPayload = payload;
            return { error: null };
          },
        };
      }
      return { select: () => ({}) };
    },
  } as const;

  const request = new Request(`http://localhost/api/v1/boards/${boardId}/controls`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      locks: { question: true },
      hud: { showPulse: false },
    }),
  });

  const response = await patchControls(
    request,
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }) as never,
      createSupabaseServerClientFn: () => supabaseClient as never,
      getBoardControlsFn: async () =>
        buildDefaultControls(boardId),
      nowFn: () => 1700000000000,
    },
  );

  assert.equal(response.status, 200);
  assert.ok(upsertPayload);
  assert.deepEqual(upsertPayload?.locks, { question: true, help: false, pulse: false });
  assert.deepEqual(upsertPayload?.hud, { showRoster: true, showPulse: false, showPinned: true });
});
