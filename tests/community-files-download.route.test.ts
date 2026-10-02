import assert from "node:assert/strict";
import test from "node:test";

import { GET as downloadCommunityFile } from "@/app/api/v1/community/files/[fileId]/download/route";

test("community file download rejects unauthenticated request", async () => {
  const response = await downloadCommunityFile(
    new Request("http://localhost/api/v1/community/files/file-1/download"),
    { params: Promise.resolve({ fileId: "file-1" }) },
    {
      createSupabaseServerClientFn: () =>
        ({
          auth: {
            getUser: async () => ({ data: { user: null }, error: new Error("unauthorized") }),
          },
        }) as any,
    },
  );

  assert.equal(response.status, 401);
});

test("community file download enforces post linkage", async () => {
  const response = await downloadCommunityFile(
    new Request("http://localhost/api/v1/community/files/file-1/download"),
    { params: Promise.resolve({ fileId: "file-1" }) },
    {
      createSupabaseServerClientFn: () =>
        ({
          auth: {
            getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
          },
          from: (table: string) => {
            if (table === "community_posts") {
              return {
                select: () => ({
                  contains: () => ({
                    eq: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({ data: null, error: null }),
                      }),
                    }),
                  }),
                }),
              };
            }
            throw new Error(`unexpected table ${table}`);
          },
        }) as any,
    },
  );

  assert.equal(response.status, 403);
});

test("community file download redirects when linked", async () => {
  const response = await downloadCommunityFile(
    new Request("http://localhost/api/v1/community/files/file-1/download"),
    { params: Promise.resolve({ fileId: "file-1" }) },
    {
      presignGetUrlFn: async () => "https://cdn.example.com/object",
      createSupabaseServerClientFn: () =>
        ({
          auth: {
            getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }),
          },
          from: (table: string) => {
            if (table === "community_posts") {
              return {
                select: () => ({
                  contains: () => ({
                    eq: () => ({
                      limit: () => ({
                        maybeSingle: async () => ({ data: { id: "post-1" }, error: null }),
                      }),
                    }),
                  }),
                }),
              };
            }

            if (table === "board_files") {
              return {
                select: () => ({
                  eq: () => ({
                    is: () => ({
                      maybeSingle: async () => ({ data: { id: "file-1", r2_key: "k" }, error: null }),
                    }),
                  }),
                }),
              };
            }

            throw new Error(`unexpected table ${table}`);
          },
        }) as any,
    },
  );

  assert.equal(response.status, 307);
  assert.equal(response.headers.get("location"), "https://cdn.example.com/object");
});
