import test from "node:test";
import assert from "node:assert/strict";
import { COURSEWARE_PUBLIC_ASSETS_BASE_URL, DAY01_AI_ROLE_ASSETS, DAY01_COURSEWARE_ASSET_ROOT, day01Asset } from "@/lib/edu/courseware/assets/coursewareAssetManifest";

test("day01 asset manifest uses public assets domain and day01 root", () => {
  assert.equal(COURSEWARE_PUBLIC_ASSETS_BASE_URL, "https://assets.gomdory.com");
  assert.ok(DAY01_COURSEWARE_ASSET_ROOT.includes("edu/courseware/day01/ai-role-studio"));
  assert.ok(!JSON.stringify(DAY01_AI_ROLE_ASSETS).includes("models.gomdory.com"));
});

test("day01 required asset keys exist and urls are deterministic", () => {
  for (const key of ["layoutSoftDashboard", "voiceAssistantIcon", "resultCardTemplate", "loadingIllustration", "errorIllustration"] as const) {
    assert.ok(DAY01_AI_ROLE_ASSETS[key].startsWith("https://assets.gomdory.com/"));
  }
  assert.equal(day01Asset("icons/voice-assistant-icon"), `${COURSEWARE_PUBLIC_ASSETS_BASE_URL}/${DAY01_COURSEWARE_ASSET_ROOT}/icons/voice-assistant-icon.png`);
  assert.equal(day01Asset("icons/voice-assistant-icon.png", "webp"), `${COURSEWARE_PUBLIC_ASSETS_BASE_URL}/${DAY01_COURSEWARE_ASSET_ROOT}/icons/voice-assistant-icon.webp`);
});
