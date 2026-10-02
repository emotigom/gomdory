import assert from "node:assert/strict";
import test from "node:test";

import { createUploadIntentForOwner, UploadIntentError } from "@/lib/data/files";

function createFakeSupabase(canEdit: boolean, wallOwnerId = "user-1") {
  let insertPayload: Record<string, unknown> | null = null;

  const fake = {
    from(table: string) {
      if (table === "cards") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              is() {
                return this;
              },
              async single() {
                return {
                  data: { id: "card-1", owner_id: "user-1", wall_id: "wall-1", deleted_at: null, walls: { board_id: "board-1", boards: { owner_id: wallOwnerId } } },
                  error: null,
                };
              },
            };
          },
        };
      }
      if (table === "files") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              or() {
                return this;
              },
              limit() {
                return this;
              },
              async maybeSingle() {
                return { data: null, error: null };
              },
            };
          },
          insert(payload: Record<string, unknown>) {
            insertPayload = payload;
            return {
              select() {
                return {
                  async single() {
                    return { data: { id: "file-1" }, error: null };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
    async rpc(fn: string) {
      if (fn === "board_role") {
        return { data: canEdit ? "owner" : "viewer", error: null };
      }
      if (fn === "storage_total_bytes") {
        return { data: 0, error: null };
      }
      return { data: null, error: null };
    },
    getInsertPayload() {
      return insertPayload;
    },
  };

  return fake;
}

function createFakeSupabaseWithInsertFailure(isMember: boolean) {
  const fake = createFakeSupabase(isMember) as Record<string, unknown>;
  return {
    ...fake,
    from(table: string) {
      if (table === "files") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              or() {
                return this;
              },
              limit() {
                return this;
              },
              async maybeSingle() {
                return { data: null, error: null };
              },
            };
          },
          insert() {
            return {
              select() {
                return {
                  async single() {
                    return { data: null, error: { code: "23502", message: "null value in column \"mime\" of relation \"files\" violates not-null constraint" } };
                  },
                };
              },
            };
          },
        };
      }
      return (fake.from as (tableName: string) => unknown)(table);
    },
  };
}

test("createUploadIntentForOwner inserts trusted owner/card payload with canonical required columns", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";

  const supabase = createFakeSupabase(true);
  await createUploadIntentForOwner({
    supabase: supabase as never,
    ownerUserId: "user-1",
    cardId: "card-1",
    filename: "demo.pdf",
    contentType: "application/pdf",
    sizeBytes: 100,
  });

  const insert = supabase.getInsertPayload();
  assert.ok(insert);
  assert.equal(insert?.owner_id, "user-1");
  assert.equal(insert?.owner_user_id, "user-1");
  assert.equal(insert?.card_id, "card-1");
  assert.equal(insert?.status, "pending");
  assert.equal(insert?.content_type, "application/pdf");
  assert.equal(insert?.mime, "application/pdf");
  assert.equal(insert?.filename, "demo.pdf");
  assert.equal(insert?.original_name, "demo.pdf");
  assert.equal(insert?.size_bytes, 100);
  assert.deepEqual(insert?.tags, []);
  assert.match(String(insert?.r2_key), /^gom\/boards\/board-1\//);
});

test("createUploadIntentForOwner throws card_forbidden when card editor permission fails", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";

  const supabase = createFakeSupabase(false, "other-user");

  await assert.rejects(
    () =>
      createUploadIntentForOwner({
        supabase: supabase as never,
        ownerUserId: "user-1",
        cardId: "card-1",
        filename: "demo.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      }),
    /card_forbidden/,
  );
});

test("createUploadIntentForOwner throws upload_card_not_found for missing/deleted card", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";

  const supabase = {
    from(table: string) {
      if (table === "cards") {
        return {
          select() {
            return {
              eq() {
                return this;
              },
              async single() {
                return { data: null, error: { code: "PGRST116", message: "not found" } };
              },
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  await assert.rejects(
    () =>
      createUploadIntentForOwner({
        supabase: supabase as never,
        ownerUserId: "user-1",
        cardId: "missing-card",
        filename: "demo.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      }),
    (error) => {
      assert.ok(error instanceof UploadIntentError);
      assert.equal(error.stage, "load_card");
      assert.equal(error.code, "upload_card_not_found");
      return true;
    },
  );
});

test("createUploadIntentForOwner allows board owner without editable board_role", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";

  const supabase = createFakeSupabase(false, "user-1");
  const result = await createUploadIntentForOwner({
    supabase: supabase as never,
    ownerUserId: "user-1",
    cardId: "card-1",
    filename: "demo.pdf",
    contentType: "application/pdf",
    sizeBytes: 100,
  });
  assert.equal(result.fileId, "file-1");
});

test("createUploadIntentForOwner requires non-empty ownerId", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";

  const supabase = createFakeSupabase(true);

  await assert.rejects(
    () =>
      createUploadIntentForOwner({
        supabase: supabase as never,
        ownerUserId: "",
        cardId: "card-1",
        filename: "demo.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      }),
    /owner_id_required/,
  );
});

test("createUploadIntentForOwner handles browser initiate payload metadata shape", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";
  process.env.R2_ACCOUNT_ID = "acc";
  process.env.R2_BUCKET = "bucket";
  process.env.R2_ACCESS_KEY_ID = "key";
  process.env.R2_SECRET_ACCESS_KEY = "secret";

  const supabase = createFakeSupabase(true);
  await createUploadIntentForOwner({
    supabase: supabase as never,
    ownerUserId: "user-1",
    cardId: "card-1",
    filename: "도장2.png",
    contentType: "image/png",
    sizeBytes: 119868,
    originalBytes: 119868,
    originalSizeBytes: 119868,
    storedBytes: 119868,
    optimized: false,
    optimizedSizeBytes: 119868,
    optimizationFormat: "png",
    width: 337,
    height: 320,
    contentSha256: "6c982b9edf7580cdfab2eb39033581e34eec1e928eff8340a5c1808b58f27f0d",
    sha256Hex: "6c982b9edf7580cdfab2eb39033581e34eec1e928eff8340a5c1808b58f27f0d",
  });

  const insert = supabase.getInsertPayload();
  assert.ok(insert);
  assert.equal(insert?.size_bytes, 119868);
  assert.equal(insert?.stored_bytes, 119868);
  assert.equal(insert?.content_type, "image/png");
  assert.equal(insert?.filename, "_2.png");
  assert.equal(insert?.sha256_hex, "6c982b9edf7580cdfab2eb39033581e34eec1e928eff8340a5c1808b58f27f0d");
  assert.equal(insert?.content_sha256, "6c982b9edf7580cdfab2eb39033581e34eec1e928eff8340a5c1808b58f27f0d");
  assert.match(String(insert?.r2_key), /\.png$/);
  assert.equal(String(insert?.r2_key).includes("image/png"), false);
});

test("createUploadIntentForOwner maps db insert failure to typed upload_file_record_failed", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";

  const supabase = createFakeSupabaseWithInsertFailure(true);
  await assert.rejects(
    () =>
      createUploadIntentForOwner({
        supabase: supabase as never,
        ownerUserId: "user-1",
        cardId: "card-1",
        filename: "도장2.png",
        contentType: "image/png",
        sizeBytes: 119868,
      }),
    (error: unknown) => {
      assert.ok(error instanceof UploadIntentError);
      assert.equal(error.code, "upload_file_record_failed");
      assert.equal(error.stage, "create_file_row");
      assert.equal(error.supabaseCode, "23502");
      assert.equal(error.diagnostics?.stage, "create_file_row");
      assert.equal(error.diagnostics?.ownerUserIdPresent, true);
      assert.equal(error.diagnostics?.ownerIdPresent, true);
      return true;
    },
  );
});


test("createUploadIntentForOwner surfaces mime column in create_file_row diagnostics on NOT NULL failure", async () => {
  process.env.STORAGE_MAX_BYTES = "5000000";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";

  const supabase = createFakeSupabaseWithInsertFailure(true);
  await assert.rejects(
    () =>
      createUploadIntentForOwner({
        supabase: supabase as never,
        ownerUserId: "user-1",
        cardId: "card-1",
        filename: "demo.pdf",
        contentType: "application/pdf",
        sizeBytes: 100,
      }),
    (error) => {
      assert.ok(error instanceof UploadIntentError);
      assert.equal(error.code, "upload_file_record_failed");
      assert.equal(error.stage, "create_file_row");
      assert.equal(error.supabaseCode, "23502");
      assert.equal(error.diagnostics?.notNullColumn, "mime");
      assert.equal(error.diagnostics?.insertHasMime, true);
      return true;
    },
  );
});

test("createUploadIntentForOwner rejects oversized upload before file row creation", async () => {
  process.env.STORAGE_MAX_BYTES = "100";
  process.env.STORAGE_MAX_BYTES_PER_TENANT = "50000000";

  const supabase = createFakeSupabase(true);

  await assert.rejects(
    () =>
      createUploadIntentForOwner({
        supabase: supabase as never,
        ownerUserId: "user-1",
        cardId: "card-1",
        filename: "too-large.pdf",
        contentType: "application/pdf",
        sizeBytes: 101,
      }),
    (error) => {
      assert.ok(error instanceof UploadIntentError);
      assert.equal(error.code, "upload_request_invalid");
      assert.equal(error.stage, "build_file_record");
      return true;
    },
  );

  assert.equal(supabase.getInsertPayload(), null);
});
