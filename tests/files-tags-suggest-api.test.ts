import assert from "node:assert/strict";
import test from "node:test";

import { GET as tagsSuggestGet } from "@/app/api/v1/files/tags/suggest/route";

test("files tags suggest API returns tags", async () => {
  const response = await tagsSuggestGet(new Request("http://localhost/api/v1/files/tags/suggest"), undefined, {
    requireUserApiFn: async () => ({ user: { id: "user-1", app_metadata: {}, user_metadata: {} } }),
    listBoardFileTagSuggestionsFn: async () => ["math", "science"],
  });

  const body = (await response.json()) as { ok?: boolean; tags?: string[] };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.tags, ["math", "science"]);
});
