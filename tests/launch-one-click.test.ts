import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { POST as launchPost } from "@/app/api/v1/boards/[boardId]/launch/route";

const boardId = "00000000-0000-4000-8000-000000000000";

test("launch endpoint returns href for class navigation", async () => {
  const request = new Request(`http://localhost/api/v1/boards/${boardId}/launch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ intent: "class", source: "gallery" }),
  });

  const response = await launchPost(
    request,
    { params: Promise.resolve({ boardId }) },
    {
      requireUserApiFn: async () => ({ user: { id: "teacher-1" } }),
      createSupabaseServerClientFn: () =>
        ({
          rpc: async () => ({ data: "owner", error: null }),
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { id: boardId, share_code: null, share_enabled: false },
                  error: null,
                }),
              }),
            }),
          }),
        }) as any,
      enableSharingFn: async () => ({ share_code: "abc123" } as any),
    },
  );

  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.action?.href, `/dashboard/boards/${boardId}/board`);
  assert.equal(payload.meta?.shareCode, "abc123");
});

test("gallery card CTA stays interactive without body links", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "gallery", "_components", "GalleryCard.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes("<article"));
  assert.ok(!content.match(/<article[^>]*href=/));
  assert.ok(!content.match(/<article[^>]*onClick=/));
  assert.ok(content.includes('data-interactive="true"'));
});
