import assert from "node:assert/strict";
import { test } from "node:test";

import { assertSameOriginApi } from "../lib/http/sameOrigin";
import { routes } from "@/lib/standards/routes";

test("allows same-origin relative API paths", () => {
  assert.doesNotThrow(() => assertSameOriginApi(routes.api.ops.ping(), "https://www.gomdory.com"));
});

test("blocks cross-origin API paths", () => {
  assert.throws(
    () =>
      assertSameOriginApi(new URL(routes.api.ops.ping(), "https://gkrry.com"), "https://www.gomdory.com"),
    /API requests must target the same origin/,
  );
});
