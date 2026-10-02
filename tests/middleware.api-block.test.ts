import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

test("short host fetch to teacher API passes through for API routes", async () => {
  const request = new NextRequest("https://gkrry.com/api/v1/files?limit=12", {
    headers: {
      host: "gkrry.com",
      "sec-fetch-mode": "cors",
      "sec-fetch-dest": "empty",
    },
  });

  const response = await middleware(request);
  assert.equal(response?.status, 200);
  assert.equal(
    response?.headers.get("x-gomdori-host-action"),
    "pass",
  );
  assert.equal(response?.headers.get("x-gomdori-host"), "gkrry.com");
  assert.equal(response?.headers.get("x-gomdori-path"), "/api/v1/files");
});

test("short host navigation to teacher API also passes through", async () => {
  const request = new NextRequest("https://gkrry.com/api/v1/files", {
    headers: {
      host: "gkrry.com",
      "sec-fetch-mode": "navigate",
    },
  });

  const response = await middleware(request);

  assert.equal(response?.status, 200);
  assert.equal(response?.headers.get("location"), null);
  assert.equal(response?.headers.get("x-gomdori-host-action"), "pass");
});
