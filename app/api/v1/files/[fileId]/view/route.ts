import { requireUserApi } from "@/lib/auth/requireUserApi";
import { applyNoStoreHeaders, withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { getBoardFileReadUrl, sanitizeBoardFilename } from "@/lib/data/boardFiles";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Dependencies = {
  requireUserApiFn?: typeof requireUserApi;
  createSupabaseClientFn?: typeof createSupabaseServerClient;
  getBoardFileReadUrlFn?: typeof getBoardFileReadUrl;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const ensureUser = deps?.requireUserApiFn ?? requireUserApi;
  const supabase = deps?.createSupabaseClientFn?.() ?? createSupabaseServerClient();
  const getReadUrl = deps?.getBoardFileReadUrlFn ?? getBoardFileReadUrl;
  const requestId = getOrCreateRequestId(request);
  const route = new URL(request.url).pathname;
  const method = "GET";

  const logStandardizedFileEvent = (input: { fileId: string; ownerId: string; status: number; code: string }) => {
    console.info(
      JSON.stringify({
        requestId,
        fileId: input.fileId,
        ownerId: input.ownerId,
        route,
        method,
        status: input.status,
        code: input.code,
      }),
    );
  };

  let userId: string | null = null;
  try {
    const { user } = await ensureUser();
    userId = user.id;
  } catch {
    const { fileId } = await params;
    logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 401, code: "UNAUTHORIZED" });
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
      logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 404, code: "NOT_FOUND" });
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404, undefined, withNoStoreHeaders());
    }

    const readUrl = await getReadUrl(data.r2_key);
    const r2Response = await fetch(readUrl);

    if (!r2Response.ok || !r2Response.body) {
      logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 502, code: "FILE_UNAVAILABLE" });
      return jsonErrorWithRequestId("FILE_UNAVAILABLE", "file_unavailable", requestId, 502, undefined, withNoStoreHeaders());
    }

    const filename = sanitizeBoardFilename(data.filename ?? "file");
    const headers = applyNoStoreHeaders(new Headers(r2Response.headers));
    headers.set("content-type", data.mime ?? "application/octet-stream");
    headers.set("content-disposition", `inline; filename="${filename}"`);
    headers.set("x-request-id", requestId);
    headers.set("x-gom-request-id", requestId);

    logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: r2Response.status, code: "OK" });
    return new Response(r2Response.body, {
      status: r2Response.status,
      headers,
    });
  } catch (error) {
    const { fileId } = await params;
    const message = error instanceof Error ? error.message : "파일을 열 수 없습니다.";
    logStandardizedFileEvent({ fileId, ownerId: userId ?? "", status: 400, code: "VIEW_FAILED" });
    return jsonErrorWithRequestId("VIEW_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}
