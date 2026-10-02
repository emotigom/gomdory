import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { resolvePublishedStudentAppAsset } from "@/lib/student-apps/serveStudentAppDeployment";

function fakeSupabase(row: any) {
  return {
    from: () => ({
      select: () => {
        const chain: any = {
          eq: () => chain,
          is: () => chain,
          not: () => chain,
          maybeSingle: async () => ({ data: row, error: null }),
        };
        return chain;
      },
    }),
  } as any;
}

function dep(overrides: any = {}) {
  return {
    id: "deploy_123456",
    r2_prefix: "student-apps/private/board/deploy/v1/",
    entry_file: "index.html",
    manifest: { files: [{ path: "index.html", contentType: "text/html" }, { path: "styles/app.css", contentType: "text/css" }] },
    title: "t",
    status: "published",
    published_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const bucket = (obj: any) => ({ get: async () => obj }) as any;

test("published status with published_at is served", async () => {
  const res = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket({ body: "ok", httpMetadata: { contentType: "text/html" } }), deploymentId: "deploy_123456", host: "eduview.gkrry.com" });
  assert.equal(res.ok, true);
});

test("stored status, missing published_at, deleted/unknown are not served", async () => {
  const stored = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(null), bucket: bucket({ body: "ok" }), deploymentId: "deploy_123456", host: "eduview.gkrry.com" });
  assert.equal(stored.ok, false);
  assert.equal(stored.reason, "not_found");
});

test("empty asset path resolves to index and traversal rejected", async () => {
  const ok = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket({ body: "ok", httpMetadata: { contentType: "text/html" } }), deploymentId: "deploy_123456", assetPath: [], host: "localhost:3000" });
  assert.equal(ok.ok, true);
  const bad = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket({ body: "ok" }), deploymentId: "deploy_123456", assetPath: ["..", "x"], host: "localhost" });
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, "invalid_asset_path");
});

test("asset manifest/r2 checks and headers", async () => {
  const noManifest = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket({ body: "ok" }), deploymentId: "deploy_123456", assetPath: ["missing.js"], host: "eduview.gkrry.com" });
  assert.equal(noManifest.ok, false);
  const noR2 = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket(null), deploymentId: "deploy_123456", assetPath: ["styles", "app.css"], host: "eduview.gkrry.com" });
  assert.equal(noR2.ok, false);
  const css = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket({ body: "css", httpMetadata: { contentType: "text/css" } }), deploymentId: "deploy_123456", assetPath: ["styles", "app.css"], host: "eduview.gkrry.com" });
  assert.equal(css.ok, true);
  if (css.ok) {
    assert.equal(css.cacheControl, "public, max-age=31536000, immutable");
    assert.equal(Boolean(css.headers["content-security-policy"]), false);
    assert.equal(JSON.stringify(css).includes("r2_prefix"), false);
  }
});

test("html gets csp and short cache", async () => {
  const html = await resolvePublishedStudentAppAsset({ supabase: fakeSupabase(dep()), bucket: bucket({ body: "html", httpMetadata: { contentType: "text/html" } }), deploymentId: "deploy_123456", host: "eduview.gkrry.com" });
  assert.equal(html.ok, true);
  if (html.ok) {
    assert.equal(html.cacheControl, "public, max-age=60, must-revalidate");
    assert.match(html.headers["content-security-policy"], /default-src 'self'/);
    assert.match(html.headers["content-security-policy"], /frame-ancestors https:\/\/gkrry\.com/);
    assert.equal(html.headers["content-disposition"], "inline");
  }
});

test("source guard imports", () => {
  const source = readFileSync("lib/student-apps/serveStudentAppDeployment.ts", "utf8");
  assert.doesNotMatch(source, /cloudflare:env|node:crypto|node:buffer/);
});
