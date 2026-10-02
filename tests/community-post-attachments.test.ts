import assert from "node:assert/strict";
import test from "node:test";

import {
  assertAllowedCommunityAttachmentMime,
  parseCommunityAttachmentFileIds,
  parseCommunityExternalAttachments,
} from "@/lib/community/postAttachments";

test("community attachments rejects file id count over 3", () => {
  assert.throws(
    () =>
      parseCommunityAttachmentFileIds(
        JSON.stringify([
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
          "44444444-4444-4444-8444-444444444444",
        ]),
      ),
    /최대 3개/,
  );
});

test("community attachments rejects links over 1", () => {
  assert.throws(
    () => parseCommunityExternalAttachments(JSON.stringify([{ kind: "link", url: "https://a.com" }, { kind: "link", url: "https://b.com" }])),
    /최대 1개/,
  );
});

test("community attachments reject disallowed mime", () => {
  assert.throws(() => assertAllowedCommunityAttachmentMime("application/x-msdownload"), /지원하지 않는 파일 형식/);
});
