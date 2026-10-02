import assert from "node:assert/strict";
import test from "node:test";

import { cancelTask, enqueue, retryTask, startNext, type UploadTask } from "@/lib/uploads/uploadQueue";

const makeFile = (name: string) => new File(["hello"], name, { type: "text/plain" });

test("enqueue adds pending tasks", () => {
  const tasks = enqueue([], [makeFile("a.txt"), makeFile("b.txt")], (() => {
    let index = 0;
    return () => `id-${++index}`;
  })());

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0]?.id, "id-1");
  assert.equal(tasks[0]?.state, "pending");
  assert.equal(tasks[1]?.id, "id-2");
  assert.equal(tasks[1]?.state, "pending");
});

test("startNext transitions pending -> committed on success", async () => {
  const initial = enqueue([], [makeFile("a.txt")], () => "id-1");
  const next = await startNext(initial, async () => undefined);

  assert.equal(next[0]?.state, "committed");
  assert.equal(next[0]?.error, undefined);
});

test("cancelTask marks pending task as failed", () => {
  const initial = enqueue([], [makeFile("a.txt")], () => "id-1");
  const next = cancelTask(initial, "id-1");

  assert.equal(next[0]?.state, "failed");
  assert.equal(next[0]?.error, "업로드가 취소되었습니다.");
});

test("retryTask resets only failed task", () => {
  const tasks: UploadTask[] = [
    { id: "id-1", file: makeFile("a.txt"), state: "failed", error: "x" },
    { id: "id-2", file: makeFile("b.txt"), state: "committed" },
  ];

  const next = retryTask(tasks, "id-1");

  assert.equal(next[0]?.state, "pending");
  assert.equal(next[0]?.error, undefined);
  assert.equal(next[1]?.state, "committed");
});

test("startNext marks failed when upload throws", async () => {
  const initial = enqueue([], [makeFile("a.txt")], () => "id-1");
  const next = await startNext(initial, async () => {
    throw new Error("boom");
  });

  assert.equal(next[0]?.state, "failed");
  assert.equal(next[0]?.error, "boom");
});
