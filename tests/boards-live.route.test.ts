import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { buildShareUrl } from "@/lib/http/publicLinks";
import { routes } from "@/lib/standards/routes";
import { GET as liveGet } from "@/app/api/v1/boards/[boardId]/live/route";

const boardId = "00000000-0000-4000-8000-000000000000";

function createSupabaseClient({ shareCode }: { shareCode: string | null }) {
  return {
    rpc: async () => ({ data: "owner", error: null }),
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              active_session_id: null,
              share_code: shareCode,
            },
            error: null,
          }),
        }),
      }),
    }),
  } as any;
}

test("boards live returns ok with missing share code warning", async () => {
  const request = new NextRequest(new Request(new URL(routes.api.boards.live(boardId), "http://localhost")));

  const response = await liveGet(
    request,
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }),
      getLiveSnapshotByBoardFn: async () => ({
        status: "uninitialized",
        snapshot: null,
        warning: { code: "no_live_session_yet", message: "라이브 세션이 아직 시작되지 않았습니다." },
        session: null,
      }),
      createSupabaseServerClientFn: () => createSupabaseClient({ shareCode: null }),
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.warning?.code, "missing_share_code");
  assert.equal(payload.share?.code, null);
  assert.equal(payload.share?.url, null);
  assert.equal(payload.live?.status, "uninitialized");
  assert.equal(payload.live?.snapshot, null);
});

test("boards live returns ok with no live session warning", async () => {
  const shareCode = "ABCD";
  const request = new NextRequest(new Request(new URL(routes.api.boards.live(boardId), "http://localhost")));

  const response = await liveGet(
    request,
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }),
      getLiveSnapshotByBoardFn: async () => ({
        status: "uninitialized",
        snapshot: null,
        warning: { code: "no_live_session_yet", message: "라이브 세션이 아직 시작되지 않았습니다." },
        session: null,
      }),
      createSupabaseServerClientFn: () => createSupabaseClient({ shareCode }),
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.warning?.code, "no_live_session_yet");
  assert.equal(payload.share?.code, shareCode);
  assert.equal(payload.share?.url, buildShareUrl(shareCode));
  assert.equal(payload.live?.status, "uninitialized");
  assert.equal(payload.live?.snapshot, null);
});

test("boards live returns ok false when unauthorized", async () => {
  const request = new NextRequest(new Request(new URL(routes.api.boards.live(boardId), "http://localhost")));

  const response = await liveGet(
    request,
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
      getLiveSnapshotByBoardFn: async () => ({
        status: "uninitialized",
        snapshot: null,
        session: null,
      }),
      createSupabaseServerClientFn: () => createSupabaseClient({ shareCode: null }),
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.ok, false);
  assert.equal(payload.error?.code, "unauthorized");
});
