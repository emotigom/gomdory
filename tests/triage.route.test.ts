import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { POST as triagePost } from "@/app/api/v1/boards/[boardId]/triage/actions/[actionId]/route";
import { makeMockUser } from "@/tests/helpers/mockUser";

const boardId = "00000000-0000-4000-8000-000000000000";

test("triage actions API blocks unauthenticated requests", async () => {
  const request = new NextRequest(
    new Request(`http://localhost/api/v1/boards/${boardId}/triage/actions/action-1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "approve" }),
    }),
  );

  const response = await triagePost(
    request,
    { params: Promise.resolve({ boardId, actionId: "action-1" }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
    },
  );

  assert.equal(response.status, 401);
});

test("triage actions API updates status", async () => {
  let savedStatus: string | null = null;
  const request = new NextRequest(
    new Request(`http://localhost/api/v1/boards/${boardId}/triage/actions/action-1`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ op: "approve" }),
    }),
  );

  const response = await triagePost(
    request,
    { params: Promise.resolve({ boardId, actionId: "action-1" }) },
    {
      requireUserApiFn: async () => ({
        user: makeMockUser({ id: "teacher-1" }),
      }),
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
          boardId,
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
            boardId,
            ts: Date.now(),
            ...patch,
          } as any,
          version: 2,
        };
      },
      appendEventFn: async () => ({ ok: true }),
    },
  );

  const payload = (await response.json()) as { ok?: boolean; status?: string };
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.status, "approved");
  assert.equal(savedStatus, "approved");
});
