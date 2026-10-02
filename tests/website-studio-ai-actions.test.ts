import test from "node:test";
import assert from "node:assert/strict";
import { validateWebsiteStudioAiAction } from "@/lib/website-studio/websiteStudioAiActions";
import { createLocalWebsiteProjectFromTemplate } from "@/lib/website-studio/websiteStudioLocalStore";

test("unknown actions rejected", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  const result = validateWebsiteStudioAiAction({ action: "hack", summary: "요약", warnings: [] }, project);
  assert.equal(result.ok, false);
});

test("unsafe fields rejected", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  const block = project.pages[0].blocks[0];
  const result = validateWebsiteStudioAiAction({ action: "updateBlockText", targetBlockId: block.id, summary: "요약", warnings: [], patch: { title: "<script>alert(1)</script>" } }, project);
  assert.equal(result.ok, false);
});
