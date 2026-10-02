import assert from "node:assert/strict";
import test from "node:test";

import { classifyUploadError, createUploadError, toUserMessage } from "@/lib/uploads/uploadErrors";

test("classifyUploadError maps network failures", () => {
  assert.equal(classifyUploadError(new TypeError("Failed to fetch")), "network");
});

test("classifyUploadError maps forbidden failures", () => {
  assert.equal(
    classifyUploadError(new Error("forbidden"), { status: 403, message: "forbidden" }),
    "forbidden",
  );
});

test("classifyUploadError maps too large failures", () => {
  assert.equal(
    classifyUploadError("payload too large", { status: 413, code: "PAYLOAD_TOO_LARGE" }),
    "tooLarge",
  );
});

test("classifyUploadError maps unsupported type failures", () => {
  assert.equal(
    classifyUploadError("unsupported content-type", { status: 415, code: "UNSUPPORTED_MEDIA_TYPE" }),
    "unsupportedType",
  );
});

test("toUserMessage returns safe message without raw backend text", () => {
  const message = toUserMessage("unknown");
  assert.equal(message, "업로드에 실패했어요. 재시도해 주세요.");
  assert.equal(message.includes("SQL"), false);
});

test("createUploadError maps stage-safe backend code to friendly Korean copy", () => {
  const err = createUploadError("Upload storage URL failed", { code: "upload_storage_url_failed", status: 500 });
  assert.equal(err.message, "파일 업로드 주소를 준비하지 못했어요.");
});

test("createUploadError maps file policy rejections to teacher and student friendly copy", () => {
  const unsupported = createUploadError("설치 파일이나 실행 파일은 첨부할 수 없습니다.", {
    code: "unsupported_file_type",
    status: 415,
  });
  assert.equal(unsupported.message, "설치 파일(.exe)은 보안상 첨부할 수 없어요. 공식 다운로드 링크를 카드에 붙여 주세요.");

  const tooLarge = createUploadError("파일이 너무 큽니다.", {
    code: "file_too_large",
    status: 413,
  });
  assert.equal(tooLarge.message, "파일이 너무 큽니다. 50MB 이하 파일만 올리거나 드라이브 링크를 사용해 주세요.");
});
