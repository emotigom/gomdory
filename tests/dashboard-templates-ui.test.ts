import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import { buildTemplatesQuery, fetchTemplatesWith } from "@/app/dashboard/templates/TemplateGalleryClient";

test("dashboard templates page exposes page marker", () => {
  const filePath = path.join(process.cwd(), "app", "dashboard", "templates", "page.tsx");
  const content = fs.readFileSync(filePath, "utf8");
  assert.ok(content.includes('data-page-marker="dashboard-templates"'));
});

test("template search triggers fetch with query", async () => {
  let requestedUrl = "";

  const mockFetch = async (url: string) => {
    requestedUrl = url;
    return new Response(JSON.stringify({ ok: true, items: [], nextCursor: null }), { status: 200 });
  };

  await fetchTemplatesWith(mockFetch as never, { query: "과학" });

  assert.equal(requestedUrl, buildTemplatesQuery({ query: "과학" }));
});
