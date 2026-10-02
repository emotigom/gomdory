import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsPage = readFileSync("app/dashboard/settings/page.tsx", "utf8");
const customizePage = readFileSync("app/dashboard/settings/customize/page.tsx", "utf8");
const settingsItems = readFileSync("app/dashboard/_components/dashboardSettingsItems.ts", "utf8");

test("settings pages use the workshop desk instead of a generic dashboard header", () => {
  assert.match(settingsPage, /data-dashboard-settings-workshop/);
  assert.match(settingsPage, /수업 작업대를/);
  assert.match(settingsPage, /shadow-\[6px_6px_0_var\(--theme-text\)\]/);
  assert.match(settingsPage, /--gom-yellow/);
  assert.match(settingsPage, /--gom-blue/);
  assert.match(settingsPage, /getCurrentUserOpsAdmin/);
  assert.match(settingsPage, /!item\.requiresAdmin \|\| isOpsAdmin/);
  assert.doesNotMatch(settingsPage, /bg-\[#(?:e6f05a|f0643c|77c7a2|2d56d6)\]/);
  assert.doesNotMatch(settingsPage, /DashboardPurposeHeader|rounded-2xl|backdrop-blur|gradient/);
});

test("customize page keeps feature flag behavior inside a purpose-built screen kit", () => {
  assert.match(customizePage, /data-dashboard-customize-workshop/);
  assert.match(customizePage, /const customPagesV2Enabled = isDashboardCustomPagesV2Enabled\(\)/);
  assert.match(customizePage, /dashboard-custom-pages-v2-enabled/);
  assert.match(customizePage, /dashboard-custom-pages-v2-disabled/);
  assert.match(customizePage, /UserCustomizationPanelV2/);
  assert.match(customizePage, /UserCustomizationPanel/);
  assert.match(customizePage, /눈이 편하고,/);
  assert.match(customizePage, /--gom-orange/);
  assert.match(customizePage, /--theme-action-bg/);
  assert.doesNotMatch(customizePage, /bg-\[#(?:e6f05a|f0643c|77c7a2|2d56d6|f5f0e6)\]/);
  assert.doesNotMatch(customizePage, /DashboardPurposeHeader|rounded-2xl|backdrop-blur|gradient/);
});

test("settings directory speaks in classroom tasks without implementation notes", () => {
  for (const marker of [
    "수업 살림",
    "화면과 작업 방식",
    "수업 도구함",
    "관리 도구",
    "내 화면 꾸미기",
  ]) {
    assert.match(settingsItems, new RegExp(marker));
  }

  for (const staleCopy of [
    "Recovered",
    "복원된 기능",
    "다시 연결합니다",
    "고급/실험실",
    "Diagnostics",
    "Ops Console",
    "Audit 로그",
  ]) {
    assert.doesNotMatch(settingsItems, new RegExp(staleCopy));
  }

  for (const behaviorMarker of [
    "routes.page.dashboard.billing()",
    "routes.page.dashboard.settingsCustomize()",
    "routes.page.dashboard.import.padlet()",
    "routes.page.dashboard.opsWorkQueue()",
    "requiresAdmin: true",
  ]) {
    assert.match(settingsItems, new RegExp(behaviorMarker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
