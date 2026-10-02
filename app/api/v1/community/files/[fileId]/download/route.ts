import { NextResponse } from "next/server";

import { applyNoStoreHeaders, withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { presignGetUrl } from "@/lib/r2/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Dependencies = {
  createSupabaseServerClientFn?: typeof createSupabaseServerClient;
  presignGetUrlFn?: typeof presignGetUrl;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GET_URL_EXPIRES_SECONDS = 600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
  deps?: Dependencies,
) {
  const requestId = getOrCreateRequestId(request);
  const supabase = (deps?.createSupabaseServerClientFn ?? createSupabaseServerClient)();
  const presign = deps?.presignGetUrlFn ?? presignGetUrl;

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  const { fileId } = await params;

  const { data: linkedPost, error: linkedError } = await supabase
    .from("community_posts")
    .select("id")
    .contains("attachment_file_ids", [fileId])
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (linkedError) {
    return jsonErrorWithRequestId("SUPABASE_ERROR", linkedError.message, requestId, 400, undefined, withNoStoreHeaders());
  }

  if (!linkedPost) {
    return jsonErrorWithRequestId("FORBIDDEN", "forbidden", requestId, 403, undefined, withNoStoreHeaders());
  }

  const { data: boardFile, error: boardFileError } = await supabase
    .from("board_files")
    .select("id,r2_key,deleted_at")
    .eq("id", fileId)
    .is("deleted_at", null)
    .maybeSingle();

  if (boardFileError || !boardFile) {
    return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const url = await presign({ key: boardFile.r2_key, expiresSeconds: GET_URL_EXPIRES_SECONDS });
  const response = NextResponse.redirect(url);
  applyNoStoreHeaders(response.headers);
  response.headers.set("x-request-id", requestId);
  response.headers.set("x-gom-request-id", requestId);

  return response;
}
