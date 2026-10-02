import assert from "node:assert/strict";
import test from "node:test";

import { uploadReducer, type UploadState } from "@/app/dashboard/boards/[boardId]/files/uploadReducer";

const mockFile = { name: "demo.png", size: 1234, type: "image/png" } as unknown as File;

function reduce(state: UploadState, action: Parameters<typeof uploadReducer>[1]) {
  return uploadReducer(state, action);
}

test("uploadReducer transitions queued to uploading to success", () => {
  const initial: UploadState = { items: [] };
  const enqueued = reduce(initial, {
    type: "enqueue",
    items: [{ id: "1", file: mockFile, status: "queued", progress: 0 }],
  });
  assert.equal(enqueued.items[0]?.status, "queued");

  const uploading = reduce(enqueued, { type: "start", id: "1" });
  assert.equal(uploading.items[0]?.status, "uploading");

  const progressed = reduce(uploading, { type: "progress", id: "1", progress: 50 });
  assert.equal(progressed.items[0]?.progress, 50);

  const done = reduce(progressed, { type: "success", id: "1", file: { id: "file-1" } });
  assert.equal(done.items[0]?.status, "success");
  assert.equal(done.items[0]?.fileId, "file-1");
});

test("uploadReducer retries failed upload", () => {
  const failedState: UploadState = {
    items: [{ id: "2", file: mockFile, status: "failed", progress: 10, error: "boom" }],
  };
  const retried = reduce(failedState, { type: "retry", id: "2" });
  assert.equal(retried.items[0]?.status, "queued");
  assert.equal(retried.items[0]?.progress, 0);
  assert.equal(retried.items[0]?.error, undefined);
});
