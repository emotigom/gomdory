import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "@/app/api/v1/boards/[boardId]/lesson-session/web-studio/submissions/route";

const boardId = "73eecf6f-8a10-488d-94a0-e43c7f905405";
const user = { id: "teacher-1" };

function request(id = boardId) {
  return new Request(`http://localhost/api/v1/boards/${id}/lesson-session/web-studio/submissions`);
}

test("web studio submissions route rejects malformed board IDs", async () => {
  let helperCalled = false;
  const response = await GET(
    request("../abc"),
    { params: Promise.resolve({ boardId: "../abc" }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      getWebCodingLiteSubmissionsForBoardFn: async () => {
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

test("web studio submissions route requires an authenticated teacher", async () => {
  let helperCalled = false;
  const response = await GET(
    request(),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
      getWebCodingLiteSubmissionsForBoardFn: async () => {
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

test("web studio submissions route maps permission failures to 403 for non-owner viewers and guests", async () => {
  const response = await GET(
    request(),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "viewer-1" } }) as never,
      getWebCodingLiteSubmissionsForBoardFn: async () => {
        throw new Error("웹 코딩 제출물을 볼 권한이 없습니다.");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "web_studio_submissions_failed");
});

test("web studio submissions route returns teacher-only full code for owners/editors", async () => {
  let received: { boardId: string; userId: string } | null = null;
  const response = await GET(
    request(),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      getWebCodingLiteSubmissionsForBoardFn: async (receivedBoardId, actor) => {
        received = { boardId: receivedBoardId, userId: actor.userId };
        return {
          activityRunId: "run-web",
          activityTitle: "웹 코딩 실습실",
          submissions: [
            {
              id: "state-1",
              studentLabel: "익명 학생 1",
              savedAt: "2026-05-15T00:00:00.000Z",
              submitted: true,
              submittedAt: "2026-05-15T00:01:00.000Z",
              html: "<h1>Submitted</h1>",
              css: "body{}",
              js: "console.log('iframe only')",
              counts: {
                html: { chars: 18, lines: 1 },
                css: { chars: 6, lines: 1 },
                js: { chars: 26, lines: 1 },
                totalChars: 50,
                totalLines: 3,
              },
            },
          ],
        };
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(received, { boardId, userId: "teacher-1" });
  assert.equal(payload.data.submissions[0].html, "<h1>Submitted</h1>");
  assert.equal(JSON.stringify(payload).includes("participant_key_hash"), false);
});
