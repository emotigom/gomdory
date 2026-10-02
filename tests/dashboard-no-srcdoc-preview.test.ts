import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("dashboard route does not mount website studio preview iframe", () => {
  const dashboardPage = fs.readFileSync("app/dashboard/page.tsx", "utf8");
  const dashboardClient = fs.readFileSync("app/dashboard/DashboardClientImpl.tsx", "utf8");

  assert.doesNotMatch(dashboardPage, /WebsiteStudioPreviewFrame/);
  assert.doesNotMatch(dashboardClient, /WebsiteStudioPreviewFrame/);
  assert.doesNotMatch(dashboardPage, /srcDoc=/);
  assert.doesNotMatch(dashboardClient, /srcDoc=/);
});

test("website studio preview iframe remains sandboxed without allow-scripts", () => {
  const previewFrame = fs.readFileSync("app/dashboard/websites/_components/WebsiteStudioPreviewFrame.tsx", "utf8");
  assert.match(previewFrame, /sandbox="allow-same-origin"/);
  assert.doesNotMatch(previewFrame, /allow-scripts/);
});
