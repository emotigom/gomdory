import assert from "node:assert/strict";
import test from "node:test";

import { ensureEduGalleryEntryForSlug } from "@/lib/edu/gallerySync";
import { EDU_COLUMNS, EDU_TABLES } from "@/lib/standards/eduDb";

test("edu view lazy sync inserts missing gallery row", async () => {
  let insertedPayload: Record<string, unknown> | null = null;

  const galleryQuery = {
    select: () => galleryQuery,
    eq: () => galleryQuery,
    maybeSingle: async () => ({ data: null, error: null }),
    insert: async (payload: Record<string, unknown>) => {
      insertedPayload = payload;
      return { error: null };
    },
  };

  const projectQuery = {
    select: () => projectQuery,
    eq: () => projectQuery,
    maybeSingle: async () => ({
      data: {
        share_code: "wyvdv5",
        title: "발표 잘하기",
        author_name: "학생",
        lesson_id: 1,
        created_at: new Date("2024-03-01T00:00:00.000Z").toISOString(),
      },
      error: null,
    }),
  };

  const statsQuery = {
    select: () => statsQuery,
    eq: () => statsQuery,
    maybeSingle: async () => ({ data: { [EDU_COLUMNS.viewCount]: 7 }, error: null }),
  };

  const result = await ensureEduGalleryEntryForSlug("view-1", {
    createSupabaseAdminClientFn: () => ({
      from: (table: string) => {
        if (table === EDU_TABLES.gallery) return galleryQuery;
        if (table === EDU_TABLES.projects) return projectQuery;
        if (table === EDU_TABLES.projectStats) return statsQuery;
        throw new Error(`Unexpected table: ${table}`);
      },
    }),
  });

  assert.equal(result.inserted, true);
  assert.ok(insertedPayload);
  assert.equal(insertedPayload?.view_id, "view-1");
  assert.equal(insertedPayload?.class_code, "wyvdv5");
  assert.equal(insertedPayload?.lesson_key, "P1");
  assert.equal(insertedPayload?.title, "발표 잘하기");
  assert.equal(insertedPayload?.author_name, "학생");
  assert.equal(insertedPayload?.view_count, 7);
});
