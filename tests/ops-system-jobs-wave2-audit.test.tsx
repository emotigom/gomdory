import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OpsSystemJobsPage from "@/app/dashboard/ops/system-jobs/page";
import RequestIdCopyButton from "@/app/dashboard/ops/system-jobs/RequestIdCopyButton";

test("wave2 audit section anchor renders even when supabase env is missing", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServerUrl = process.env.SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const element = await OpsSystemJobsPage({
      searchParams: Promise.resolve({}),
    });

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, element));
    assert.match(html, /href="#wave2-audit"/);
    assert.match(html, /id="wave2-audit"/);
    assert.match(html, /Wave 2 audit를 불러오지 못했습니다/);
  } finally {
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServerUrl) process.env.SUPABASE_URL = originalServerUrl;
    if (originalServiceRole) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  }
});

test("wave2 q search mode updates title and banner", async () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalServerUrl = process.env.SUPABASE_URL;
  const originalServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const element = await OpsSystemJobsPage({
      searchParams: Promise.resolve({ q: "req_wave2_001" }),
    });

    const html = renderToStaticMarkup(React.createElement(React.Fragment, null, element));
    assert.match(html, /Wave 2 audits \(request_id 검색 최대 10건\)/);
    assert.match(html, /검색 모드: request_id=<code>req_wave2_001<\/code> \(최대 10건\)/);
  } finally {
    if (originalUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalServerUrl) process.env.SUPABASE_URL = originalServerUrl;
    if (originalServiceRole) process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRole;
  }
});

test("request id copy button exposes an aria-label", () => {
  const html = renderToStaticMarkup(<RequestIdCopyButton requestId="req_wave2_aria" />);
  assert.match(html, /aria-label="Copy request_id req_wave2_aria"/);
});
