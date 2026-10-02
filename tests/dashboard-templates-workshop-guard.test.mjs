import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pagePath = "app/dashboard/templates/page.tsx";
const clientPath = "app/dashboard/templates/TemplateGalleryClient.tsx";

test("templates page uses one workshop cabinet header", async () => {
  const page = await readFile(pagePath, "utf8");

  assert.match(page, /data-dashboard-templates-workshop="2"/);
  assert.match(page, /data-workshop-surface="template-cabinet"/);
  assert.match(page, /템플릿 보관함/);
  assert.match(page, /고르기/);
  assert.match(page, /미리보기/);
  assert.match(page, /가져오기/);
  assert.doesNotMatch(page, /DashboardPurposeHeader/);
  assert.doesNotMatch(page, /다음 행동|상태 힌트/);
  assert.match(page, /px-4/);
  assert.match(page, /bg-\[var\(--theme-text\)\][^"\n]*text-\[var\(--theme-bg\)\]/);
  assert.match(page, /bg-\[var\(--theme-accent\)\][^"\n]*text-\[var\(--theme-accent-text\)\]/);
  assert.doesNotMatch(page, /text-white|border-white|bg-black/);
});

test("template gallery keeps its product contracts inside the workshop surface", async () => {
  const client = await readFile(clientPath, "utf8");

  assert.match(client, /data-template-gallery-workshop/);
  assert.match(client, /data-template-workshop-card/);
  assert.match(client, /aria-label="템플릿 서랍"/);
  assert.match(client, /aria-label="템플릿 정렬"/);
  assert.match(client, /min-h-11/);
  assert.match(client, /--theme-card/);
  assert.match(client, /--theme-text/);
  assert.match(client, /--theme-border-strong/);

  for (const contract of [
    'apiV1Path("templates")',
    'apiV1Path("template-collections")',
    'apiV1Path(`template-collections/${slug}`)',
    'apiV1Path(`templates/${template.id}/import`)',
    'apiV1Path(`templates/${templateId}/report`)',
    'apiV1Path(`templates/${previewTemplate.id}/admin`)',
    "isOpsOwner",
    "hasProTemplates",
    "proEnabled",
    "publishDashboardInvalidate",
  ]) {
    assert.ok(client.includes(contract), `missing template contract: ${contract}`);
  }
});

test("template cabinet drops generic SaaS cards and production-note copy", async () => {
  const client = await readFile(clientPath, "utf8");

  assert.doesNotMatch(client, /rounded-3xl|bg-indigo-|text-indigo-|border-indigo-/);
  assert.doesNotMatch(client, /text-slate-|border-slate-|bg-slate-/);
  assert.doesNotMatch(client, /톤으로 안내합니다|선택한 경로 유지|10초 만에/);
  assert.match(client, /role="dialog"/);
  assert.match(client, /aria-modal="true"/);
  assert.match(client, /event\.key === "Escape"/);
  assert.match(client, /previousFocus\?\.isConnected/);
  assert.match(client, /focus-visible:ring-\[var\(--theme-focus\)\]/);
  assert.match(client, /bg-\[var\(--theme-accent\)\][^"`\n]*text-\[var\(--theme-accent-text\)\]/);
  assert.match(client, /aria-label=\{locked \? `\$\{template\.title\} Pro 이용 안내 열기`/);
  assert.match(client, /locked \? lockedLabel \?\? "Pro 안내 보기"/);
  assert.doesNotMatch(client, /aria-disabled=\{locked\}/);
  assert.match(client, /aria-haspopup="menu"/);
  assert.match(client, /aria-controls=\{reportMenuOpen \? reportMenuId : undefined\}/);
  assert.match(client, /menu\.id = reportMenuId/);
  assert.match(client, /role="menuitem"/);
  assert.match(client, /focusReportMenuItem\(getEnabledReportMenuItems\(currentMenu\), 0\)/);
  assert.match(client, /closeReportMenuAndRestoreFocus/);
  for (const key of ["ArrowDown", "ArrowUp", "Home", "End"]) {
    assert.ok(client.includes(`event.key !== "${key}"`) || client.includes(`event.key === "${key}"`), `missing report menu key: ${key}`);
  }
});
