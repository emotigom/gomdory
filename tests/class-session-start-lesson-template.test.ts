import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { POST } from "@/app/api/v1/classes/[classId]/sessions/start/route";

const validBoardId = "11111111-1111-4111-8111-111111111111";

test("POST start accepts lessonTemplateId lesson_03_vibe_app_planning", async () => {
  let receivedLessonTemplateId: string | null | undefined;
  const request = new NextRequest("http://localhost/api/v1/classes/class-1/sessions/start", {
    method: "POST",
    body: JSON.stringify({ boardId: validBoardId, lessonTemplateId: "lesson_03_vibe_app_planning" }),
    headers: { "content-type": "application/json" },
  });

  const response = await POST(request, { params: Promise.resolve({ classId: "class-1" }) }, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    validateSupabaseEnvFn: () => ({ ok: true }),
    startClassSessionFn: async ({ lessonTemplateId }) => {
      receivedLessonTemplateId = lessonTemplateId;
      return { id: "s1", share_code: "ABC123", lesson_template_id: lessonTemplateId ?? null } as never;
    },
  });

  assert.equal(response.status, 200);
  assert.equal(receivedLessonTemplateId, "lesson_03_vibe_app_planning");
});

test("POST start accepts lessonTemplateId lesson_04_vibe_app_prototype_share", async () => {
  let receivedLessonTemplateId: string | null | undefined;
  const request = new NextRequest("http://localhost/api/v1/classes/class-1/sessions/start", {
    method: "POST",
    body: JSON.stringify({ boardId: validBoardId, lessonTemplateId: "lesson_04_vibe_app_prototype_share" }),
    headers: { "content-type": "application/json" },
  });

  const response = await POST(request, { params: Promise.resolve({ classId: "class-1" }) }, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    validateSupabaseEnvFn: () => ({ ok: true }),
    startClassSessionFn: async ({ lessonTemplateId }) => {
      receivedLessonTemplateId = lessonTemplateId;
      return { id: "s1", share_code: "ABC123", lesson_template_id: lessonTemplateId ?? null } as never;
    },
  });

  assert.equal(response.status, 200);
  assert.equal(receivedLessonTemplateId, "lesson_04_vibe_app_prototype_share");
});

test("POST start rejects invalid lessonTemplateId with 400", async () => {
  const request = new NextRequest("http://localhost/api/v1/classes/class-1/sessions/start", {
    method: "POST",
    body: JSON.stringify({ boardId: validBoardId, lessonTemplateId: "not_allowed" }),
    headers: { "content-type": "application/json" },
  });

  const response = await POST(request, { params: Promise.resolve({ classId: "class-1" }) }, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    validateSupabaseEnvFn: () => ({ ok: true }),
    startClassSessionFn: async () => ({}) as never,
  });

  assert.equal(response.status, 400);
});

test("POST start omits lessonTemplateId and preserves existing behavior", async () => {
  let receivedLessonTemplateId: string | null | undefined = "marker";
  const request = new NextRequest("http://localhost/api/v1/classes/class-1/sessions/start", {
    method: "POST",
    body: JSON.stringify({ boardId: validBoardId }),
    headers: { "content-type": "application/json" },
  });

  const response = await POST(request, { params: Promise.resolve({ classId: "class-1" }) }, {
    requireUserApiFn: async () => ({ user: { id: "u1" } }) as never,
    validateSupabaseEnvFn: () => ({ ok: true }),
    startClassSessionFn: async ({ lessonTemplateId }) => {
      receivedLessonTemplateId = lessonTemplateId;
      return { id: "s1", share_code: "ABC123", lesson_template_id: null } as never;
    },
  });

  assert.equal(response.status, 200);
  assert.equal(receivedLessonTemplateId, null);
});

test("startSession insert payload includes lesson_template_id when provided", async () => {
  const source = await import("node:fs/promises").then((m) =>
    m.readFile(`${process.cwd()}/lib/data/sessionsReport.ts`, "utf8"),
  );
  assert.match(source, /lesson_template_id: lessonTemplateId \?\? null/);
});
