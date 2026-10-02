import test from "node:test";
import assert from "node:assert/strict";
import { buildWebsiteStudioAiPrompt, isWebsiteStudioAiAssistantEnabled } from "@/lib/website-studio/websiteStudioAiPrompts";

test("flag default false", () => {
  delete process.env.NEXT_PUBLIC_WEBSITE_STUDIO_AI_ASSISTANT_V1;
  assert.equal(isWebsiteStudioAiAssistantEnabled(), false);
});

test("prompt has json and no raw html/js instruction", () => {
  const prompt = buildWebsiteStudioAiPrompt({ actionLabel: "제목" });
  assert.match(prompt, /JSON만/);
  assert.match(prompt, /raw HTML, JS/);
});
