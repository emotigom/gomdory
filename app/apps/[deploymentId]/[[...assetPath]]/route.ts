import { NextRequest } from "next/server";

import { getEduBucketFromRuntimeEnv } from "@/lib/cloudflare/getCloudflareRuntimeEnv";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolvePublishedStudentAppAsset } from "@/lib/student-apps/serveStudentAppDeployment";
import { rewritePublishedStudentAppHtmlAssetUrls } from "@/lib/student-apps/rewritePublishedStudentAppHtml";

const error = (status: number, code: string) => Response.json({ ok: false, error: { code } }, { status, headers: { "cache-control": "no-store" } });

export async function GET(request: NextRequest, context: { params: Promise<{ deploymentId: string; assetPath?: string[] }> }) {
  const params = await context.params;
  const isRootAppRequest = !params.assetPath || params.assetPath.length === 0;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const eduBucket = getEduBucketFromRuntimeEnv();

  const result = await resolvePublishedStudentAppAsset({
    supabase: createSupabaseAdminClient() as unknown as Parameters<typeof resolvePublishedStudentAppAsset>[0]["supabase"],
    bucket: eduBucket,
    deploymentId: params.deploymentId,
    assetPath: params.assetPath,
    host,
  });

  if (!result.ok) {
    if (result.reason === "storage_unavailable") return error(503, "storage_unavailable");
    if (result.reason === "invalid_asset_path" || result.reason === "invalid_deployment_id" || result.reason === "invalid_host" || result.reason === "not_found") {
      return new Response("Not Found", { status: 404, headers: { "cache-control": "no-store" } });
    }
    return error(500, "internal_error");
  }

  const headers = new Headers(result.headers);
  headers.set("content-type", result.contentType.toLowerCase().includes("text/html") ? "text/html; charset=utf-8" : result.contentType);
  headers.set("cache-control", result.cacheControl);

  if (isRootAppRequest && result.contentType.toLowerCase().includes("text/html")) {
    const html = await new Response(result.body).text();
    const rewrittenHtml = rewritePublishedStudentAppHtmlAssetUrls(html, params.deploymentId);
    return new Response(rewrittenHtml, { status: 200, headers });
  }

  return new Response(result.body, { status: 200, headers });
}
