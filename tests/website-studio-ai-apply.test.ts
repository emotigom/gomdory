import test from "node:test";
import assert from "node:assert/strict";
import { applyWebsiteStudioAiAction } from "@/lib/website-studio/websiteStudioAiActions";
import { createLocalWebsiteProjectFromTemplate } from "@/lib/website-studio/websiteStudioLocalStore";

test("apply updates allowed fields only", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  const block = project.pages[0].blocks[0];
  const next = applyWebsiteStudioAiAction(project, { action: "updateBlockText", targetBlockId: block.id, summary: "요약", warnings: [], patch: { title: "새 제목" } });
  assert.equal(next.pages[0].blocks[0].title, "새 제목");
});
