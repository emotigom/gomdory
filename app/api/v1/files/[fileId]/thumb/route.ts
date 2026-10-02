import { requireUserApi } from "@/lib/auth/requireUserApi";
import { applyNoStoreHeaders, withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { getBoardFileReadUrl, sanitizeBoardFilename } from "@/lib/data/boardFiles";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { isShortHost } from "@/lib/http/siteConfig";
import { getRequestHost } from "@/lib/http/requestHost";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseClientFn?: typeof createSupabaseServerClient;
  getBoardFileReadUrlFn?: typeof getBoardFileReadUrl;
  getRequestHostFn?: typeof getRequestHost;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const supabase = deps?.createSupabaseClientFn?.() ?? createSupabaseServerClient();
  const getReadUrl = deps?.getBoardFileReadUrlFn ?? getBoardFileReadUrl;
  const resolveHost = deps?.getRequestHostFn ?? getRequestHost;
  const requestId = getOrCreateRequestId(request);

  const host = await resolveHost(request.headers);
  if (host && isShortHost(host)) {
    return jsonErrorWithRequestId(
      "SHORT_HOST_FORBIDDEN",
      "short_host_forbidden",
      requestId,
      403,
      undefined,
      withNoStoreHeaders(),
    );
  }

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  try {
    const { fileId } = await params;
    const { data, error } = await supabase
      .from("board_files")
      .select("id, r2_key, filename, mime, owner_id, deleted_at")
      .eq("id", fileId)
      .eq("owner_id", userId ?? "")
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404, undefined, withNoStoreHeaders());
    }

    const mime = data.mime ?? "";
    if (mime && !mime.startsWith("image/")) {
      return jsonErrorWithRequestId("UNSUPPORTED_TYPE", "unsupported_type", requestId, 415, undefined, withNoStoreHeaders());
    }

    const readUrl = await getReadUrl(data.r2_key);
    const r2Response = await fetch(readUrl);

    if (!r2Response.ok || !r2Response.body) {
      return jsonErrorWithRequestId("FILE_UNAVAILABLE", "file_unavailable", requestId, 502, undefined, withNoStoreHeaders());
    }

    const filename = sanitizeBoardFilename(data.filename ?? "file");
    const headers = applyNoStoreHeaders(new Headers(r2Response.headers));
    headers.set("content-type", data.mime ?? "application/octet-stream");
    headers.set("content-disposition", `inline; filename="${filename}"`);
    headers.set("x-request-id", requestId);
    headers.set("x-gom-request-id", requestId);

    return new Response(r2Response.body, {
      status: r2Response.status,
      headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "파일을 열 수 없습니다.";
    return jsonErrorWithRequestId("THUMB_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}
