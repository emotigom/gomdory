import assert from "node:assert/strict";
import test from "node:test";

import { autoPublishStudentAppSubmission, getAutoPublishBlockingWarnings } from "@/lib/student-apps/autoPublishStudentAppSubmission";
import { validateStudentAppAutoPublishWindow } from "@/lib/student-apps/submissionWindow";
import { validateStudentStaticApp } from "@/lib/student-apps/staticAppValidator";

const now = new Date("2026-07-14T03:00:00.000Z");
const openSession = (publish_mode: "teacher_review" | "auto_publish" = "auto_publish") => ({
  id: "session-1",
  status: "active",
  starts_at: "2026-07-14T00:00:00.000Z",
  ends_at: "2026-07-19T14:59:59.000Z",
  ended_at: null,
  publish_mode,
  started_by: "teacher-1",
});

function makeSupabase(session: ReturnType<typeof openSession> | null, existingDeploymentId: string | null = null) {
  return {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        is: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: async () => table === "student_app_class_sessions"
          ? { data: session, error: null }
          : { data: existingDeploymentId ? { id: existingDeploymentId } : null, error: null },
      };
      return chain;
    },
  };
}

const bucket = {} as R2Bucket;
const safe = { warnings: [], blockedReasons: [] };

test("existing sessions default to teacher review behavior", async () => {
  let stored = 0;
  const result = await autoPublishStudentAppSubmission({
    bucket,
    supabase: makeSupabase(openSession("teacher_review")) as never,
    boardId: "board-1",
    submissionId: "submission-1",
    rawPayload: {},
    safety: { warnings: ["inline_event_handler_detected"], blockedReasons: [] },
    now,
    storeDeployment: async () => { stored += 1; return {} as never; },
  });
  assert.equal(result.status, "teacher_review");
  assert.equal(stored, 0);
});

test("an open auto-publish session stores and publishes exactly once", async () => {
  let stored = 0;
  let published = 0;
  const result = await autoPublishStudentAppSubmission({
    bucket,
    supabase: makeSupabase(openSession()) as never,
    boardId: "board-1",
    submissionId: "submission-1",
    rawPayload: {},
    safety: { warnings: ["inline_event_handler_detected"], blockedReasons: [] },
    now,
    storeDeployment: async (input) => {
      stored += 1;
      assert.equal(input.userId, "teacher-1");
      assert.equal(input.sourceSubmissionId, "submission-1");
      return { ok: true, deployment: { id: "deployment-1" } } as never;
    },
    publishDeployment: async (input) => {
      published += 1;
      assert.equal(input.userId, "teacher-1");
      return { ok: true, deployment: { publicUrl: "https://eduview.gkrry.com/apps/deployment-1/" } } as never;
    },
  });
  assert.deepEqual(result, { status: "published", deploymentId: "deployment-1", publicUrl: "https://eduview.gkrry.com/apps/deployment-1/" });
  assert.equal(stored, 1);
  assert.equal(published, 1);
});

test("closed-session re-read wins the submission-end race", async () => {
  let stored = 0;
  const result = await autoPublishStudentAppSubmission({
    bucket,
    supabase: makeSupabase({ ...openSession(), ended_at: "2026-07-14T02:59:59.000Z" }) as never,
    boardId: "board-1",
    submissionId: "submission-1",
    rawPayload: {},
    safety: safe,
    now,
    storeDeployment: async () => { stored += 1; return {} as never; },
  });
  assert.equal(result.status, "session_closed");
  assert.equal(stored, 0);
});

test("validation and high-risk warnings are never auto-published", async () => {
  assert.deepEqual(getAutoPublishBlockingWarnings(["ignored_safe_file:a.psd", "inline_event_handler_detected"]), []);
  assert.deepEqual(getAutoPublishBlockingWarnings(["form_action_detected", "network_request_api_detected"]), ["form_action_detected", "network_request_api_detected"]);
  let stored = 0;
  for (const safety of [
    { warnings: ["external_script_src_detected"], blockedReasons: [] },
    { warnings: [], blockedReasons: ["dangerous_file:secret.env"] },
  ]) {
    const result = await autoPublishStudentAppSubmission({
      bucket,
      supabase: makeSupabase(openSession()) as never,
      boardId: "board-1",
      submissionId: "submission-1",
      rawPayload: {},
      safety,
      now,
      storeDeployment: async () => { stored += 1; return {} as never; },
    });
    assert.equal(result.status, "needs_teacher_review");
  }
  assert.equal(stored, 0);
});

test("network requests in a separate JavaScript file are classified as high risk", async () => {
  const validation = await validateStudentStaticApp({
    title: "network app",
    source: "manual_files",
    files: [
      { path: "index.html", contentType: "text/html", content: "<script src=\"script.js\"></script>" },
      { path: "script.js", contentType: "application/javascript", content: "fetch('https://example.com/collect', { method: 'POST' })" },
    ],
  });
  assert.equal(validation.ok, true);
  assert.equal(validation.manifest.safety.warnings.includes("network_request_api_detected"), true);
  assert.deepEqual(getAutoPublishBlockingWarnings(validation.manifest.safety.warnings), ["network_request_api_detected"]);
});

test("publish failure keeps the stored deployment available for teacher retry", async () => {
  let stored = 0;
  const result = await autoPublishStudentAppSubmission({
    bucket,
    supabase: makeSupabase(openSession()) as never,
    boardId: "board-1",
    submissionId: "submission-1",
    rawPayload: {},
    safety: safe,
    now,
    storeDeployment: async () => { stored += 1; return { ok: true, deployment: { id: "deployment-1" } } as never; },
    publishDeployment: async () => { throw new Error("publish failed"); },
  });
  assert.deepEqual(result, { status: "publish_failed", deploymentId: "deployment-1" });
  assert.equal(stored, 1);
});

test("retry reuses an existing deployment without creating a duplicate version", async () => {
  let stored = 0;
  let published = 0;
  const result = await autoPublishStudentAppSubmission({
    bucket,
    supabase: makeSupabase(openSession(), "deployment-1") as never,
    boardId: "board-1",
    submissionId: "submission-1",
    rawPayload: {},
    safety: safe,
    now,
    storeDeployment: async () => { stored += 1; return {} as never; },
    publishDeployment: async () => { published += 1; return { ok: true, deployment: { publicUrl: "https://eduview.gkrry.com/apps/deployment-1/" } } as never; },
  });
  assert.equal(result.status, "published");
  assert.equal(stored, 0);
  assert.equal(published, 1);
});

test("weekly server window rejects expired and over-seven-day starts", () => {
  assert.equal(validateStudentAppAutoPublishWindow(new Date("2026-07-20T00:00:00+09:00")).reason, "weekly_window_ended");
  assert.equal(validateStudentAppAutoPublishWindow(new Date("2026-07-01T00:00:00+09:00")).reason, "window_too_long");
  const valid = validateStudentAppAutoPublishWindow(now);
  assert.equal(valid.ok, true);
  if (valid.ok) assert.equal(valid.endsAt, "2026-07-19T14:59:59.000Z");
});
