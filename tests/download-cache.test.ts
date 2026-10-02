import assert from "node:assert/strict";
import test from "node:test";

import { __resetDownloadCacheForTests, resolveDownloadUrlWithCache } from "@/lib/files/downloadCache";

test("resolveDownloadUrlWithCache memoizes resolved url within ttl", async () => {
  __resetDownloadCacheForTests();

  let nowMs = 1_000;
  const now = () => nowMs;
  let fetchCalls = 0;
  const fetchImpl: typeof fetch = (async () => {
    fetchCalls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "https://cdn.example.com/file-a" },
    });
  }) as typeof fetch;

  const first = await resolveDownloadUrlWithCache({
    fileId: "file-a",
    downloadPath: "/api/v1/files/file-a/download",
    ttlMs: 30_000,
    now,
    fetchImpl,
  });
  const second = await resolveDownloadUrlWithCache({
    fileId: "file-a",
    downloadPath: "/api/v1/files/file-a/download",
    ttlMs: 30_000,
    now,
    fetchImpl,
  });

  assert.equal(first, "https://cdn.example.com/file-a");
  assert.equal(second, "https://cdn.example.com/file-a");
  assert.equal(fetchCalls, 1);

  nowMs += 31_000;
  const third = await resolveDownloadUrlWithCache({
    fileId: "file-a",
    downloadPath: "/api/v1/files/file-a/download",
    ttlMs: 30_000,
    now,
    fetchImpl,
  });

  assert.equal(third, "https://cdn.example.com/file-a");
  assert.equal(fetchCalls, 2);
});

test("resolveDownloadUrlWithCache de-duplicates concurrent requests", async () => {
  __resetDownloadCacheForTests();

  let resolveResponse: ((value: Response) => void) | null = null;
  let fetchCalls = 0;
  const fetchImpl: typeof fetch = (async () => {
    fetchCalls += 1;
    return await new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    });
  }) as typeof fetch;

  const firstPromise = resolveDownloadUrlWithCache({
    fileId: "file-b",
    downloadPath: "/api/v1/files/file-b/download",
    fetchImpl,
  });
  const secondPromise = resolveDownloadUrlWithCache({
    fileId: "file-b",
    downloadPath: "/api/v1/files/file-b/download",
    fetchImpl,
  });

  assert.equal(fetchCalls, 1);
  resolveResponse?.(
    new Response(null, {
      status: 302,
      headers: { location: "https://cdn.example.com/file-b" },
    }),
  );

  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  assert.equal(first, "https://cdn.example.com/file-b");
  assert.equal(second, "https://cdn.example.com/file-b");
});
