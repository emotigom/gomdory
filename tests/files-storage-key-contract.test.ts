import assert from "node:assert/strict";
import test from "node:test";

import { buildCardUploadStorageKey } from "@/lib/data/files";

test("buildCardUploadStorageKey keeps extension and never appends content type", () => {
  const key = buildCardUploadStorageKey({
    boardId: "board-1",
    cardId: "card-1",
    fileId: "file-1",
    filename: "123.jpg",
    contentType: "image/jpeg",
    now: new Date("2026-01-15T00:00:00.000Z"),
  });

  assert.equal(key, "gom/boards/board-1/cards/card-1/2026/01/file-1-123.jpg");
  assert.equal(key.includes("image/jpeg"), false);
  assert.equal(key.includes("jpimage"), false);
});

test("buildCardUploadStorageKey sanitizes filename and supports mime fallback", () => {
  const key = buildCardUploadStorageKey({
    boardId: "board-1",
    cardId: "card-1",
    fileId: "file-2",
    filename: "한글/공백 name",
    contentType: "application/pdf",
    now: new Date("2026-01-15T00:00:00.000Z"),
  });

  assert.equal(key, "gom/boards/board-1/cards/card-1/2026/01/file-2-name.pdf");
});

test("buildCardUploadStorageKey uses .bin for unknown extension and mime", () => {
  const key = buildCardUploadStorageKey({
    boardId: "board-1",
    cardId: "card-1",
    fileId: "file-3",
    filename: "archive",
    contentType: "application/x-custom-type",
    now: new Date("2026-01-15T00:00:00.000Z"),
  });

  assert.equal(key, "gom/boards/board-1/cards/card-1/2026/01/file-3-archive.bin");
});

test("buildCardUploadStorageKey keeps txt extension for charset/plain or octet-stream", () => {
  const key = buildCardUploadStorageKey({
    boardId: "board-1",
    cardId: "card-1",
    fileId: "file-4",
    filename: "complex.txt",
    contentType: "text/plain; charset=utf-8",
    now: new Date("2026-01-15T00:00:00.000Z"),
  });
  assert.equal(key, "gom/boards/board-1/cards/card-1/2026/01/file-4-complex.txt");
});

test("buildCardUploadStorageKey creates a unique key per upload id for the same file", () => {
  const base = {
    boardId: "board-1",
    cardId: "card-1",
    filename: "fairy-tale-ai-photo-card.png",
    contentType: "image/png",
    now: new Date("2026-01-15T00:00:00.000Z"),
  };

  const firstKey = buildCardUploadStorageKey({ ...base, fileId: "upload-1" });
  const secondKey = buildCardUploadStorageKey({ ...base, fileId: "upload-2" });

  assert.notEqual(firstKey, secondKey);
  assert.equal(firstKey, "gom/boards/board-1/cards/card-1/2026/01/upload-1-fairy-tale-ai-photo-card.png");
  assert.equal(secondKey, "gom/boards/board-1/cards/card-1/2026/01/upload-2-fairy-tale-ai-photo-card.png");
});
