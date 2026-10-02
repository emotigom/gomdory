import assert from "node:assert/strict";
import test from "node:test";

import { parseFirstJsonPayload } from "@/lib/edu/fileProtocol";

test("parseFirstJsonPayload accepts message payloads", () => {
  const payload = parseFirstJsonPayload('{"type":"message","message":"안녕하세요"}');
  assert.deepEqual(payload, { ok: true, payload: { type: "message", message: "안녕하세요" } });
});

test("parseFirstJsonPayload accepts files payloads", () => {
  const payload = parseFirstJsonPayload(
    '{"type":"files","message":"완료","files":{"index.html":"<html></html>"}}',
  );
  assert.deepEqual(payload, {
    ok: true,
    payload: {
      type: "files",
      message: "완료",
      files: { "index.html": "<html></html>" },
    },
  });
});

test("parseFirstJsonPayload supports legacy files-only payloads", () => {
  const payload = parseFirstJsonPayload('{"files":{"index.html":"<html></html>"}}');
  assert.deepEqual(payload, {
    ok: true,
    payload: {
      type: "files",
      message: "",
      files: { "index.html": "<html></html>" },
    },
  });
});

test("parseFirstJsonPayload returns null for non-json", () => {
  const payload = parseFirstJsonPayload("그냥 텍스트 응답입니다.");
  assert.equal(payload, null);
});

test("parseFirstJsonPayload rejects null file content", () => {
  const payload = parseFirstJsonPayload('{"type":"files","files":{"index.html":null}}');
  assert.equal(payload?.ok, false);
  assert.equal(payload?.code, "EDU_FILES_SCHEMA_INVALID");
});

test("parseFirstJsonPayload rejects object file content", () => {
  const payload = parseFirstJsonPayload(
    '{"type":"files","files":{"index.html":{"main.js":null}}}',
  );
  assert.equal(payload?.ok, false);
  assert.equal(payload?.code, "EDU_FILES_SCHEMA_INVALID");
});
