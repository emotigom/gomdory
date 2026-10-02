import assert from "node:assert/strict";
import test from "node:test";

import { buildEduPublishObjectKey, buildEduPublishPrefix } from "@/lib/edu/publish/objectKey";
import { presignPutUrl } from "@/lib/r2/client";
import { buildEduBaseSlug, buildEduVersionedSlug } from "@/lib/share/slug";

test("prepare and commit slug/prefix mapping stays aligned", () => {
  const baseSlug = buildEduBaseSlug({
    shareCode: "ABCD12",
    lessonId: 2,
    anonId: "anon-xyz-123456",
    requestId: "req-123",
  });

  const slug = buildEduVersionedSlug(baseSlug, 1);
  const prefix = buildEduPublishPrefix(slug);
  const key = buildEduPublishObjectKey(slug, "index.html");

  assert.equal(slug, baseSlug);
  assert.equal(prefix, `edu/v1/${slug}/`);
  assert.equal(key, `${prefix}index.html`);
});

test("prepare signed PUT URL path after bucket matches commit checked key", async () => {
  (globalThis as { __CLOUDFLARE_ENV__?: Record<string, string> }).__CLOUDFLARE_ENV__ = {
    R2_ACCOUNT_ID: "acct123",
    R2_BUCKET: "gom",
    R2_ACCESS_KEY_ID: "key123",
    R2_SECRET_ACCESS_KEY: "secret123",
  };

  const slug = "slug-mapping-check";
  const relativePath = "index.html";
  const checkedKey = buildEduPublishObjectKey(slug, relativePath);

  const putUrl = await presignPutUrl({
    key: checkedKey,
    contentType: "text/html",
    expiresSeconds: 600,
  });

  const parsed = new URL(putUrl);
  const encodedPathAfterBucket = parsed.pathname.replace(/^\/gom\//, "");
  const keyFromPutUrl = encodedPathAfterBucket
    .split("/")
    .map((part) => decodeURIComponent(part))
    .join("/");

  assert.equal(keyFromPutUrl, checkedKey);
});
