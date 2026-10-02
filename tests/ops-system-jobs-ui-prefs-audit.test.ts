import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OpsSystemJobsPage from "@/app/dashboard/ops/system-jobs/page";

test("ops system jobs page renders fallback notice without supabase env", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServerUrl = process.env.SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    let element: Awaited<ReturnType<typeof OpsSystemJobsPage>>;
    try {
      element = await OpsSystemJobsPage({
        searchParams: Promise.resolve({ auditAction: "all", auditWindow: "24h" }),
      });
    } catch (error) {
      assert.fail(`OpsSystemJobsPage should not throw on missing env: ${String(error)}`);
      return;
    }

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, element));
    assert.match(html, /UI prefs audit를 불러오지 못했습니다/);
    assert.match(html, /Missing env:/);
    assert.match(html, /Supabase env missing/);
    assert.match(html, /href="#alerts"/);
    assert.match(html, /href="#feature-flags-snapshot"/);
    assert.match(html, /href="#retention-status"/);
    assert.match(html, /href="#ui-prefs-audit"/);
  } finally {
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServerUrl) process.env.SUPABASE_URL = originalServerUrl;
    if (originalServiceRole) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  }
});
