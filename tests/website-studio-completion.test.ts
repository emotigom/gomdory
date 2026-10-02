import assert from "node:assert/strict";
import test from "node:test";
import { createLocalWebsiteProjectFromTemplate } from "@/lib/website-studio/websiteStudioLocalStore";
import { getWebsiteStudioCompletionPercent, getWebsiteStudioNextStep } from "@/lib/website-studio/websiteStudioCompletion";

test("completion percent deterministic", () => {
  const p = createLocalWebsiteProjectFromTemplate("self-intro-ko");
  assert.equal(getWebsiteStudioCompletionPercent(p), getWebsiteStudioCompletionPercent(p));
});

test("unsafe URL lowers completion readiness", () => {
  const p = createLocalWebsiteProjectFromTemplate("interest-research-ko");
  const cardGrid = p.pages[0].blocks.find((b) => b.kind === "cardGrid");
  if (cardGrid) {
    cardGrid.items = [
      ...cardGrid.items,
      { title: "추가 1", content: "내용" },
      { title: "추가 2", content: "내용" },
      { title: "추가 3", content: "내용" },
    ].slice(0, 3);
  } else {
    p.pages[0].blocks.push({
      id: "cardgrid-test",
      kind: "cardGrid",
      title: "카드",
      content: "",
      items: [
        { title: "추가 1", content: "내용" },
        { title: "추가 2", content: "내용" },
        { title: "추가 3", content: "내용" },
      ],
    });
  }
  const link = p.pages[0].blocks.find((b) => b.kind === "linkButton");
  if (link) link.buttonHref = "javascript:alert(1)";
  assert.match(getWebsiteStudioNextStep(p), /안전한 외부 링크/);
});
