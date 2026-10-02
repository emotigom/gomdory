import assert from "node:assert/strict";
import test from "node:test";

import { PATCH } from "@/app/api/v1/boards/[boardId]/lesson-session/web-studio/settings/route";

const boardId = "73eecf6f-8a10-488d-94a0-e43c7f905405";
const user = { id: "teacher-1" };

function request(body: unknown, id = boardId) {
  return new Request(`http://localhost/api/v1/boards/${id}/lesson-session/web-studio/settings`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

test("web studio settings route rejects malformed board IDs", async () => {
  let helperCalled = false;
  const response = await PATCH(
    request({ hintsEnabled: false }, "../abc"),
    { params: Promise.resolve({ boardId: "../abc" }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      updateWebCodingLiteHintSettingsForBoardFn: async () => {
        helperCalled = true;
        throw new Error("should not run");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "invalid_board_id");
  assert.equal(helperCalled, false);
});

test("web studio settings route requires an authenticated teacher", async () => {
  let helperCalled = false;
  const response = await PATCH(
    request({ hintsEnabled: false }),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
      updateWebCodingLiteHintSettingsForBoardFn: async () => {
        helperCalled = true;
        throw new Error("should not run");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "unauthorized");
  assert.equal(helperCalled, false);
});

test("web studio settings route rejects non-boolean hintsEnabled", async () => {
  let helperCalled = false;
  const response = await PATCH(
    request({ hintsEnabled: "false" }),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      updateWebCodingLiteHintSettingsForBoardFn: async () => {
        helperCalled = true;
        throw new Error("should not run");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "invalid_hints_enabled");
  assert.equal(helperCalled, false);
});

test("web studio settings route lets teachers turn hints off and on", async () => {
  const calls: Array<{ boardId: string; userId: string; hintsEnabled: boolean }> = [];
  for (const hintsEnabled of [false, true]) {
    const response = await PATCH(
      request({ hintsEnabled }),
      { params: Promise.resolve({ boardId }) },
      {
        requireUserApiFn: async () => ({ user }) as never,
        updateWebCodingLiteHintSettingsForBoardFn: async (params) => {
          calls.push({ boardId: params.boardId, userId: params.actor.userId, hintsEnabled: params.hintsEnabled });
          return { activityRunId: "run-web", hintsEnabled: params.hintsEnabled };
        },
      },
    );

    const payload = await response.json();
    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.data.hintsEnabled, hintsEnabled);
  }

  assert.deepEqual(calls, [
    { boardId, userId: "teacher-1", hintsEnabled: false },
    { boardId, userId: "teacher-1", hintsEnabled: true },
  ]);
});

test("web studio settings route maps viewer or guest permission failures to 403", async () => {
  const response = await PATCH(
    request({ hintsEnabled: false }),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "viewer-1" } }) as never,
      updateWebCodingLiteHintSettingsForBoardFn: async () => {
        throw new Error("웹 스튜디오 힌트 설정을 바꿀 권한이 없습니다.");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "web_studio_settings_failed");
});
