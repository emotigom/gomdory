import assert from "node:assert/strict";
import test from "node:test";

import { parseSiteContentBlocksJson, validateSiteContentBlocks } from "@/lib/site-content/blocks";

test("validateSiteContentBlocks accepts valid mixed blocks", async () => {
  const result = await validateSiteContentBlocks([
    { type: "heading", text: "제목", level: 2 },
    { type: "paragraph", text: "본문" },
    { type: "markdown", text: "- one\n- two" },
    { type: "callout", tone: "info", text: "안내" },
    { type: "links", items: [{ label: "로드맵", href: "/roadmap" }, { label: "문서", href: "https://example.com" }] },
    { type: "media", fileId: "file_1", kind: "image" },
  ], { resolveMediaFile: async () => true });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.blocks.length, 6);
});

test("validateSiteContentBlocks rejects markdown raw html", async () => {
  const result = await validateSiteContentBlocks([{ type: "markdown", text: "<iframe src='x'></iframe>" }]);
  assert.equal(result.ok, false);
});

test("validateSiteContentBlocks enforces href rules", async () => {
  const bad = await validateSiteContentBlocks([{ type: "links", items: [{ label: "bad", href: "http://insecure" }] }]);
  assert.equal(bad.ok, false);

  const ok = await validateSiteContentBlocks([{ type: "links", items: [{ label: "good", href: "https://secure.example.com" }] }]);
  assert.equal(ok.ok, true);
});

test("validateSiteContentBlocks enforces max block count", async () => {
  const list = Array.from({ length: 31 }, () => ({ type: "paragraph", text: "x" }));
  const result = await validateSiteContentBlocks(list);
  assert.equal(result.ok, false);
});

test("parseSiteContentBlocksJson validates json format", async () => {
  const result = await parseSiteContentBlocksJson("not-json");
  assert.equal(result.ok, false);
});
