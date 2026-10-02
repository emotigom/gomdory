import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as triagePost } from "@/app/api/v1/boards/[boardId]/triage/[id]/route";
import { requireUserApi } from "@/lib/auth/requireUserApi";

test("triage API updates status for action item", async () => {
  let savedStatus: string | null = null;
  const request = new NextRequest(
    new Request("http://localhost/api/v1/boards/00000000-0000-4000-8000-000000000000/triage/action-1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    }),
  );

  const response = await triagePost(
    request,
    { params: Promise.resolve({ boardId: "00000000-0000-4000-8000-000000000000", id: "action-1" }) },
    {
      requireUserApiFn: async () => ({ user: { id: "user-1" } }) as Awaited<ReturnType<typeof requireUserApi>>,
      createSupabaseServerClientFn: () =>
        ({
          rpc: async () => ({ data: "owner", error: null }),
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { share_code: "ABCD" } }),
              }),
            }),
          }),
        }) as any,
      getBoardLiveSessionFn: async () => ({
        snapshot: {
          boardId: "00000000-0000-4000-8000-000000000000",
          ts: Date.now(),
          activeSessionId: "session-1",
          studentActionTriage: {
            updatedAt: 1,
            actions: [
              {
                actionId: "action-1",
                kind: "question",
                text: "테스트 질문",
                createdAt: 1700000000000,
                status: "pending",
                updatedAt: 1700000000000,
              },
            ],
          },
        },
        version: 1,
        updated_at: new Date().toISOString(),
      }),
      upsertBoardLiveSessionFn: async (_id, patch) => {
        savedStatus = patch.studentActionTriage?.actions[0]?.status ?? null;
        return {
          snapshot: {
            boardId: "00000000-0000-4000-8000-000000000000",
            ts: Date.now(),
            ...patch,
          } as any,
          version: 2,
        };
      },
      appendEventFn: async () => ({ ok: true }),
      logAuditFn: async () => undefined,
      nowFn: () => Date.parse("2025-01-01T00:00:00Z"),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; item?: { status?: string } };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.item?.status, "approved");
  assert.equal(savedStatus, "approved");
});
