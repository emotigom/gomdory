import assert from "node:assert/strict";
import test from "node:test";

import { NextRequest } from "next/server";

import { middleware } from "@/middleware";

test("lesson entry with jt emits __Host-edu_jt Set-Cookie", async () => {
  const request = new NextRequest("https://www.gomdory.com/edu/lesson/1?jt=valid_join_token_1234", {
    headers: {
      host: "www.gomdory.com",
      "x-forwarded-proto": "https",
    },
  });

  const response = await middleware(request);
  const setCookie = response.headers.get("set-cookie") ?? "";

  assert.match(setCookie, /__Host-edu_jt=valid_join_token_1234/);
  assert.match(setCookie, /Path=\//);
  assert.match(setCookie, /HttpOnly/i);
});
