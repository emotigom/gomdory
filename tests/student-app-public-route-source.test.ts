import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("public route wiring and guards", () => {
  const path = "app/apps/[deploymentId]/[[...assetPath]]/route.ts";
  assert.equal(existsSync(path), true);
  const source = readFileSync(path, "utf8");
  assert.match(source, /createSupabaseAdminClient/);
  assert.match(source, /getEduBucketFromRuntimeEnv/);
  assert.doesNotMatch(source, /globalThis as \{ EDU_BUCKET\?: R2Bucket \}/);
  assert.match(source, /resolvePublishedStudentAppAsset/);
  assert.match(source, /rewritePublishedStudentAppHtmlAssetUrls/);
  assert.match(source, /export async function GET/);
  assert.match(source, /const isRootAppRequest = !params\.assetPath \|\| params\.assetPath\.length === 0/);
  assert.doesNotMatch(source, /Response\.redirect/);
  assert.doesNotMatch(source, /308/);
  assert.match(source, /if \(isRootAppRequest && result\.contentType\.toLowerCase\(\)\.includes\("text\/html"\)\) \{/);
  assert.match(source, /const html = await new Response\(result\.body\)\.text\(\)/);
  assert.match(source, /const rewrittenHtml = rewritePublishedStudentAppHtmlAssetUrls\(html, params\.deploymentId\)/);
  assert.match(source, /"text\/html; charset=utf-8"/);
  assert.match(source, /const result = await resolvePublishedStudentAppAsset\(/);
  assert.match(source, /assetPath: params\.assetPath/);
  assert.doesNotMatch(source, /publishStudentAppDeployment|unpublishStudentAppDeployment|POST|PUT|PATCH|DELETE|router\.refresh|jszip|fflate|adm-zip|yauzl/i);

  const workerSource = readFileSync("custom-worker.ts", "utf8");
  assert.match(workerSource, /if \(url\.hostname === "eduview\.gkrry\.com"\)/);
  assert.match(workerSource, /if \(!path\.startsWith\("\/apps\/"\)\)/);

  const wrangler = readFileSync("wrangler.jsonc", "utf8");
  assert.match(wrangler, /eduview\.gkrry\.com/);

  const serveSource = readFileSync("lib/student-apps/serveStudentAppDeployment.ts", "utf8");
  assert.match(serveSource, /base-uri 'none'/);
  assert.match(serveSource, /connect-src 'none'/);
  assert.match(serveSource, /content-disposition/);
});
