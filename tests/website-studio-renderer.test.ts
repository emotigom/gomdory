import assert from "node:assert/strict";
import test from "node:test";

import { renderWebsiteProjectToDocument, renderWebsiteProjectToHtml } from "@/lib/website-studio/websiteStudioRenderer";
import { createLocalWebsiteProjectFromTemplate } from "@/lib/website-studio/websiteStudioLocalStore";

test("renderer escapes text and blocks script tags from user text", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  project.pages[0].blocks[0].title = "<script>alert(1)</script>";
  const html = renderWebsiteProjectToHtml(project);
  assert.equal(html.includes("<script>alert(1)</script>"), false);
  assert.equal(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), true);
});

test("renderer output has no onclick attributes from user text", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  project.pages[0].blocks[1].content = 'x" onclick="alert(1)';
  const doc = renderWebsiteProjectToDocument(project);
  assert.equal(/<[^>]+\sonclick=/.test(doc), false);
});
