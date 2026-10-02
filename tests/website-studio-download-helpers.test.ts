import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard, downloadTextFile, sanitizeExportFilename } from "@/lib/website-studio/websiteStudioExportClient";

test("helpers are client guarded", async ()=>{
  assert.equal(await copyTextToClipboard("a"), false);
  assert.equal(downloadTextFile("x.txt", "a", "text/plain"), false);
});

test("filename sanitize works", ()=>{
  assert.equal(sanitizeExportFilename("My Site!@#", "gomdory-website"), "my-site");
});
