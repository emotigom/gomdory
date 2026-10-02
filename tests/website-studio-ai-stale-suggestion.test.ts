import test from "node:test";
import assert from "node:assert/strict";
import { createLocalWebsiteProjectFromTemplate } from "@/lib/website-studio/websiteStudioLocalStore";
import { canApplyWebsiteStudioSuggestionSafely } from "@/lib/website-studio/websiteStudioAiSuggestionGuard";

test("target block mismatch rejected", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  const result = canApplyWebsiteStudioSuggestionSafely(project, { targetBlockId: "missing", targetBlockKind: "text", editorRevision: 0 }, 0);
  assert.equal(result.ok, false);
});

test("kind or revision mismatch rejected", () => {
  const project = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  const block = project.pages[0].blocks[0];
  assert.equal(canApplyWebsiteStudioSuggestionSafely(project, { targetBlockId: block.id, targetBlockKind: "hero", editorRevision: 0 }, 0).ok, block.kind === "hero");
  assert.equal(canApplyWebsiteStudioSuggestionSafely(project, { targetBlockId: block.id, targetBlockKind: block.kind, editorRevision: 0 }, 1).ok, false);
});
