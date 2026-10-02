import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

function hostRequest(host: string, pathname: string) {
  return new NextRequest(`https://${host}${pathname}`, {
    headers: { host },
  });
}

test("short host redirects bare code to /s/<code> with headers intact", async () => {
  const request = new NextRequest("https://www.gkrry.com/EB2V8Q?from=qr", {
    headers: {
      host: "www.gkrry.com",
    },
  });

  const response = await middleware(request);

  assert.equal(response?.status, 308);
  assert.equal(response?.headers.get("location"), "https://www.gkrry.com/s/eb2v8q?from=qr");
  assert.equal(response?.headers.get("x-gomdori-student-code"), "eb2v8q");
  assert.equal(response?.headers.get("x-gomdori-student-route"), "/CODE->/s/CODE");
});

test("short host keeps /s/<code> requests untouched", async () => {
  const request = new NextRequest("https://www.gkrry.com/s/eb2v8q", {
    headers: {
      host: "www.gkrry.com",
    },
  });

  const response = await middleware(request);

  assert.equal(response?.headers.get("location"), null);
});

test("canonical host does not rewrite bare codes", async () => {
  const request = hostRequest("www.gomdory.com", "/eb2v8q");

  const response = await middleware(request);

  assert.equal(response?.status, 307);
  assert.equal(response?.headers.get("location"), "https://www.gkrry.com/eb2v8q");
  assert.equal(response?.headers.get("x-gomdori-host-action"), "canonical_redirect");
});

test("missing Host header still rewrites gkrry root to /s", async () => {
  const request = new NextRequest("https://www.gkrry.com/");

  const response = await middleware(request);

  assert.equal(response?.headers.get("x-gomdori-host-action"), "short_entry_rewrite_root");
  assert.equal(response?.headers.get("x-middleware-rewrite"), "https://www.gkrry.com/s");
});

test("gkrry root never passes through as marketing home", async () => {
  const request = new NextRequest("https://www.gkrry.com/", {
    headers: {
      host: "www.gkrry.com",
    },
  });

  const response = await middleware(request);

  assert.equal(response?.headers.get("x-gomdori-host-action"), "short_entry_rewrite_root");
});

test("short hosts rewrite root to /s and allow /s paths", async () => {
  const hosts = [
    { host: "gkrry.com", mode: "canonical_redirect" as const },
    { host: "www.gkrry.com", mode: "short_entry_rewrite_root" as const },
    { host: "eduview.gkrry.com", mode: "pass" as const },
  ];

  for (const { host, mode } of hosts) {
    const rootRequest = hostRequest(host, "/");
    const rootResponse = await middleware(rootRequest);

    if (mode === "canonical_redirect") {
      assert.equal(rootResponse?.headers.get("x-gomdori-host-action"), "canonical_redirect");
      assert.equal(rootResponse?.headers.get("location"), "https://www.gkrry.com/");
    } else if (mode === "short_entry_rewrite_root") {
      assert.equal(rootResponse?.headers.get("x-gomdori-host-action"), "short_entry_rewrite_root");
      assert.equal(rootResponse?.headers.get("x-middleware-rewrite"), `https://${host}/s`);
    } else {
      assert.equal(rootResponse?.headers.get("x-gomdori-host-action"), "pass");
    }

    const entryRequest = hostRequest(host, "/s");
    const entryResponse = await middleware(entryRequest);
    if (mode === "canonical_redirect") {
      assert.equal(entryResponse?.headers.get("x-gomdori-host-action"), "canonical_redirect");
      assert.equal(entryResponse?.headers.get("location"), "https://www.gkrry.com/s");
    } else {
      assert.equal(entryResponse?.headers.get("location"), null);
    }
  }
});
