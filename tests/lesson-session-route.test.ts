import assert from "node:assert/strict";
import test from "node:test";

import { DELETE, POST } from "@/app/api/v1/boards/[boardId]/lesson-session/route";
import { isValidBoardId } from "@/lib/board/idValidation";
import type { ActiveLessonSession } from "@/lib/lesson-activities/types";

const boardId = "73eecf6f-8a10-488d-94a0-e43c7f90540f";
const user = { id: "teacher-1" };

function postRequest(lessonTemplateId: unknown) {
  return new Request(`http://localhost/api/v1/boards/${boardId}/lesson-session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ lessonTemplateId }),
  });
}

function session(templateId: ActiveLessonSession["templateId"]): ActiveLessonSession {
  return {
    id: "session-1",
    boardId,
    templateId,
    title: templateId === "lesson_01_ai_intro_python_first_steps"
      ? "1차시: 생활 속 AI와 파이썬 첫걸음"
      : "2차시: AI 판단과 if/else",
    activityTypes: templateId === "lesson_01_ai_intro_python_first_steps"
      ? ["ai_bingo", "python_studio_lite"]
      : ["ai_judgment_sort", "python_studio_lite", "web_coding_lite"],
    startedAt: "2026-05-15T00:00:00.000Z",
    endedAt: null,
    status: "running",
  };
}

test("lesson-session board id validator accepts UUIDs and rejects unsafe strings", () => {
  assert.equal(isValidBoardId(boardId), true);
  assert.equal(isValidBoardId("00000000-0000-4000-8000-000000000000"), true);
  assert.equal(isValidBoardId("../abc"), false);
  assert.equal(isValidBoardId(""), false);
  assert.equal(isValidBoardId("not-a-board-id"), false);
  assert.equal(isValidBoardId("73eecf6f-8a10-488d-94a0-e43c7f90540z"), false);
});

test("lesson-session POST accepts UUID boardId and starts lesson 1", async () => {
  let received: { boardId: string; lessonTemplateId: string; userId: string } | null = null;
  const response = await POST(
    postRequest("lesson_01_ai_intro_python_first_steps"),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      startLessonSessionForBoardFn: async (receivedBoardId, lessonTemplateId, actor) => {
        received = { boardId: receivedBoardId, lessonTemplateId, userId: actor.userId };
        return session(lessonTemplateId);
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.deepEqual(received, {
    boardId,
    lessonTemplateId: "lesson_01_ai_intro_python_first_steps",
    userId: "teacher-1",
  });
  assert.deepEqual(payload.data.activityTypes, ["ai_bingo", "python_studio_lite"]);
});

test("lesson-session POST starts lesson 2 with Judgment Sort, Python, and optional Web activities", async () => {
  let receivedTemplateId = "";
  const response = await POST(
    postRequest("lesson_02_ai_judgment_if_else"),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      startLessonSessionForBoardFn: async (_receivedBoardId, lessonTemplateId) => {
        receivedTemplateId = lessonTemplateId;
        return session(lessonTemplateId);
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(receivedTemplateId, "lesson_02_ai_judgment_if_else");
  assert.deepEqual(payload.data.activityTypes, ["ai_judgment_sort", "python_studio_lite", "web_coding_lite"]);
});

test("lesson-session DELETE accepts UUID boardId", async () => {
  let receivedBoardId = "";
  const response = await DELETE(
    new Request(`http://localhost/api/v1/boards/${boardId}/lesson-session`, { method: "DELETE" }),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      endActiveLessonSessionForBoardFn: async (id) => {
        receivedBoardId = id;
        return null;
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(receivedBoardId, boardId);
});

test("lesson-session rejects malformed board IDs before reading lessonTemplateId", async () => {
  for (const malformedBoardId of ["../abc", "", "not-a-board-id", "73eecf6f-8a10-488d-94a0-e43c7f90540z"]) {
    const response = await POST(
      postRequest("lesson_01_ai_intro_python_first_steps"),
      { params: Promise.resolve({ boardId: malformedBoardId }) },
      { requireUserApiFn: async () => ({ user }) as never },
    );
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.error.code, "invalid_board_id");
  }
});

test("lesson-session reports invalid lesson template separately from valid boardId", async () => {
  let startCalled = false;
  const response = await POST(
    postRequest("lesson_99_unknown"),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      startLessonSessionForBoardFn: async () => {
        startCalled = true;
        return session("lesson_01_ai_intro_python_first_steps");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 400);
  assert.equal(payload.error.code, "invalid_lesson_template");
  assert.equal(startCalled, false);
});

test("lesson-session unauthorized user cannot start lesson", async () => {
  let startCalled = false;
  const response = await POST(
    postRequest("lesson_01_ai_intro_python_first_steps"),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => {
        throw new Error("unauthorized");
      },
      startLessonSessionForBoardFn: async () => {
        startCalled = true;
        return session("lesson_01_ai_intro_python_first_steps");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 401);
  assert.equal(payload.error.code, "unauthorized");
  assert.equal(startCalled, false);
});

test("lesson-session preserves manager permission failures", async () => {
  const response = await POST(
    postRequest("lesson_01_ai_intro_python_first_steps"),
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user }) as never,
      startLessonSessionForBoardFn: async () => {
        throw new Error("수업 실습을 관리할 권한이 없습니다.");
      },
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 403);
  assert.equal(payload.error.code, "lesson_session_start_failed");
});
