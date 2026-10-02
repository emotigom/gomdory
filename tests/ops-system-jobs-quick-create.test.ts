import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OpsSystemJobsPage from "@/app/dashboard/ops/system-jobs/page";

test("ops system jobs page renders custom page render request_id search mode with ssot anchor", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServerUrl = process.env.SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const element = await OpsSystemJobsPage({
      searchParams: Promise.resolve({ q: "req-pr26-001", customPageRenderWindow: "24h" }),
    });

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, element));
    assert.match(html, /Dashboard custom page render audit \(request_id 검색 최대 10건\)/);
    assert.match(html, /검색 모드: request_id=<code>req-pr26-001<\/code>/);
    assert.match(html, /name="customPageRenderRequestId"/);
    assert.match(html, /href="#dashboard-custom-page-render-audit"/);
    assert.match(html, /Open \/dashboard\/me \(flag ON 필요\)/);
  } finally {
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServerUrl) process.env.SUPABASE_URL = originalServerUrl;
    if (originalServiceRole) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  }
});


test("ops quick-create audit renders request_id copy button with aria-label", () => {
  const content = readFileSync("app/dashboard/ops/system-jobs/RequestIdCopyButton.tsx", "utf8");
  assert.match(content, /aria-label=\{`Copy request_id \$\{requestId\}`\}/);
});


test("ops custom page render audit reuses request_id copy button UX", () => {
  const content = readFileSync("app/dashboard/ops/system-jobs/page.tsx", "utf8");
  assert.match(content, /customPageRenderAuditLogs\.data/);
  assert.match(content, /<code className="select-text">\{row\.request_id\}<\/code>/);
  assert.match(content, /<RequestIdCopyButton requestId=\{row\.request_id\} \/>/);
  assert.match(content, /AUDIT_ACTIONS\.dashboardCustomPageRendered/);
});
