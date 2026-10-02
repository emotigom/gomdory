import assert from "node:assert/strict";
import test from "node:test";

import { POST as postCardInitiate } from "@/app/api/v1/cards/[cardId]/files/initiate/route";
import { POST as postShareCardInitiate } from "@/app/api/v1/share/[code]/cards/[cardId]/files/initiate/route";

test("cards files initiate no longer rejects non-image content type by mime gate", async () => {
  const request = new Request("http://localhost/api/v1/cards/card-1/files/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "demo.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
    }),
  });

  const response = await postCardInitiate(request, {
    params: Promise.resolve({ cardId: "card-1" }),
  });

  const payload = (await response.json()) as { error?: unknown };
  const serializedError = typeof payload.error === "string" ? payload.error : JSON.stringify(payload.error ?? {});
  assert.doesNotMatch(serializedError, /unsupported contentType|only image\/png/);
  assert.doesNotMatch(serializedError, /upload_initiate_unexpected/);
});

test("cards files initiate route module import is request-scope safe", async () => {
  const imported = await import("@/app/api/v1/cards/[cardId]/files/initiate/route");
  assert.equal(typeof imported.POST, "function");
});

test("share cards files initiate no longer rejects non-image content type by mime gate", async () => {
  const request = new Request("http://localhost/api/v1/share/abc/cards/card-1/files/initiate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: "client-1",
      filename: "demo.pdf",
      contentType: "application/pdf",
      sizeBytes: 100,
    }),
  });

  const response = await postShareCardInitiate(request, {
    params: Promise.resolve({ code: "abc", cardId: "card-1" }),
  });

  const payload = (await response.json()) as { error?: { message?: string } };
  assert.doesNotMatch(payload.error?.message ?? "", /unsupported contentType|only image\/png/);
});
