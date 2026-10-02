import assert from "node:assert/strict";
import test from "node:test";

import { POST } from "@/app/api/v1/boards/[boardId]/lesson-session/web-studio/submissions/[stateId]/create-card/route";
import { buildWebCodingLiteSubmissionCardText } from "@/lib/lesson-activities/progress";

const boardId = "73eecf6f-8a10-488d-94a0-e43c7f905405";
const stateId = "43eecf6f-8a10-488d-94a0-e43c7f905406";
const user = { id: "teacher-1" };

function request(id = boardId, submissionId = stateId) {
  return new Request(`http://localhost/api/v1/boards/${id}/lesson-session/web-studio/submissions/${submissionId}/create-card`, { method: "POST" });
}

test("web studio submission card route rejects malformed board and state IDs", async () => {
  let helperCalled = false;
  const badBoard = await POST(
    request("../abc", stateId),
    { params: Promise.resolve({ boardId: "../abc", stateId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      createWebCodingLiteSubmissionBoardCardFn: async () => {
        helperCalled = true;
        throw new Error("should not run");
      },
    },
  );
  assert.equal(badBoard.status, 400);
  assert.equal((await badBoard.json()).error.code, "invalid_board_id");

  const badState = await POST(
    request(boardId, "not-a-state"),
    { params: Promise.resolve({ boardId, stateId: "not-a-state" }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      createWebCodingLiteSubmissionBoardCardFn: async () => {
        helperCalled = true;
        throw new Error("should not run");
      },
    },
  );
  assert.equal(badState.status, 400);
  assert.equal((await badState.json()).error.code, "invalid_state_id");
  assert.equal(helperCalled, false);
});

test("web studio submission card route requires an authenticated teacher", async () => {
  let helperCalled = false;
  const response = await POST(
    request(),
    { params: Promise.resolve({ boardId, stateId }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
      createWebCodingLiteSubmissionBoardCardFn: async () => {
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

test("web studio submission card route maps permission failures and board ownership checks to 403", async () => {
  const response = await POST(
    request(),
    { params: Promise.resolve({ boardId, stateId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "viewer-1" } }) as never,
      createWebCodingLiteSubmissionBoardCardFn: async () => {
        throw new Error("웹 코딩 제출물을 볼 권한이 없습니다.");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "web_studio_submission_card_failed");
});

test("web studio submission card route requires the submission to belong to the board", async () => {
  const response = await POST(
    request(),
    { params: Promise.resolve({ boardId, stateId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      createWebCodingLiteSubmissionBoardCardFn: async () => {
        throw new Error("웹 코딩 제출물이 이 보드에 속하지 않습니다.");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 404);
  assert.equal(payload.error.code, "web_studio_submission_card_failed");
});

test("web studio submission card route creates a concise discussion card without raw code", async () => {
  let received: { boardId: string; stateId: string; userId: string } | null = null;
  const response = await POST(
    request(),
    { params: Promise.resolve({ boardId, stateId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      createWebCodingLiteSubmissionBoardCardFn: async (params) => {
        received = { boardId: params.boardId, stateId: params.stateId, userId: params.actor.userId };
        return {
          cardId: "card-1",
          wallId: "wall-1",
          studentLabel: "익명 학생 1",
          cardText: buildWebCodingLiteSubmissionCardText({
            studentLabel: "익명 학생 1",
            submitted: true,
            submittedAt: "2026-05-15T00:02:00.000Z",
            savedAt: "2026-05-15T00:01:00.000Z",
          }),
        };
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(received, { boardId, stateId, userId: "teacher-1" });
  assert.equal(payload.data.cardId, "card-1");
  assert.equal(JSON.stringify(payload).includes("participant_key_hash"), false);
});

test("web studio submission discussion card text avoids huge raw HTML CSS JS body", () => {
  const text = buildWebCodingLiteSubmissionCardText({
    studentLabel: "익명 학생 1",
    submitted: true,
    submittedAt: "2026-05-15T00:02:00.000Z",
    savedAt: "2026-05-15T00:01:00.000Z",
  });

  assert.match(text, /웹 코딩 제출물: 익명 학생 1/);
  assert.match(text, /활동: 웹 코딩 실습실/);
  assert.match(text, /상태: 제출됨/);
  assert.match(text, /교사 제출 갤러리/);
  assert.doesNotMatch(text, /<script|function decide|body\s*\{/);
  assert.ok(text.length < 500);
});
