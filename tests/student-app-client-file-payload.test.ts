import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { fileToStudentAppManualFile, filesToStudentAppManualFiles } from "@/lib/student-apps/clientFilePayload";

test("uses webkitRelativePath and text/binary payload conversion", async () => {
  const textFile = new File(["<html></html>"], "index.html", { type: "text/html" });
  Object.defineProperty(textFile, "webkitRelativePath", { value: "dist/index.html" });
  const textPayload = await fileToStudentAppManualFile(textFile);
  assert.equal(textPayload.path, "dist/index.html");
  assert.equal(typeof textPayload.contentText, "string");

  const binFile = new File([new Uint8Array([1, 2, 3])], "img.bin", { type: "application/octet-stream" });
  const binPayload = await fileToStudentAppManualFile(binFile);
  assert.equal(typeof binPayload.contentBase64, "string");
});

test("no buffer/r2 imports", () => {
  const source = readFileSync("lib/student-apps/clientFilePayload.ts", "utf8");
  assert.doesNotMatch(source, /Buffer|r2Prefix|r2Key|cloudflare/i);
});

test("encodes binary content in chunks and keeps selected file order", async () => {
  const bytes = new Uint8Array(0x8000 + 3);
  bytes.set([1, 2, 3], 0x8000);
  const files = [
    new File([bytes], "first.mid", { type: "audio/midi" }),
    new File([new Uint8Array([4, 5, 6])], "second.png", { type: "image/png" }),
  ];
  const payloads = await filesToStudentAppManualFiles(files);
  assert.deepEqual(payloads.map((file) => file.name), ["first.mid", "second.png"]);
  assert.equal(payloads[0]?.contentBase64, Buffer.from(bytes).toString("base64"));

  const source = readFileSync("lib/student-apps/clientFilePayload.ts", "utf8");
  assert.match(source, /index \+= 0x8000/);
  assert.doesNotMatch(source, /Promise\.all\(files\.map/);
});
