import { NextResponse } from "next/server";

import { applyNoStoreHeaders, withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { presignGetUrl } from "@/lib/r2/client";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const GET_URL_EXPIRES_SECONDS = 600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ fileId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  const supabase = createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return jsonErrorWithRequestId("UNAUTHORIZED", "unauthorized", requestId, 401, undefined, withNoStoreHeaders());
  }

  try {
    const { fileId } = await params;

    const { data: deletedBoardFile } = await supabase
      .from("board_files")
      .select("id")
      .eq("id", fileId)
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (deletedBoardFile) {
      return jsonErrorWithRequestId("GONE", "gone", requestId, 410, undefined, withNoStoreHeaders());
    }

    const { data: boardFile, error: boardFileError } = await supabase
      .from("board_files")
      .select("id, r2_key, board_id, deleted_at")
      .eq("id", fileId)
      .is("deleted_at", null)
      .maybeSingle();

    if (boardFileError && boardFileError.code !== "PGRST116") {
      throw new Error(boardFileError.message);
    }

    if (boardFile) {
      const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardFile.board_id });
      if (roleError || !role) {
        return jsonErrorWithRequestId("FORBIDDEN", "forbidden", requestId, 403, undefined, withNoStoreHeaders());
      }

      const url = await presignGetUrl({ key: boardFile.r2_key, expiresSeconds: GET_URL_EXPIRES_SECONDS });
      const response = NextResponse.redirect(url);
      applyNoStoreHeaders(response.headers);
      response.headers.set("x-request-id", requestId);
      response.headers.set("x-gom-request-id", requestId);
      return response;
    }

    const { data: deletedLegacyFile } = await supabase
      .from("files")
      .select("id")
      .eq("id", fileId)
      .not("deleted_at", "is", null)
      .maybeSingle();

    if (deletedLegacyFile) {
      return jsonErrorWithRequestId("GONE", "gone", requestId, 410, undefined, withNoStoreHeaders());
    }

    const { data: fileRow, error: fileError } = await supabase
      .from("files")
      .select("id, owner_id, card_id, r2_key, status, deleted_at")
      .eq("id", fileId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fileError || !fileRow || fileRow.status !== "ready") {
      return jsonErrorWithRequestId("NOT_FOUND", "not_found", requestId, 404, undefined, withNoStoreHeaders());
    }

    if (fileRow.owner_id !== user.id) {
      return jsonErrorWithRequestId("FORBIDDEN", "forbidden", requestId, 403, undefined, withNoStoreHeaders());
    }

    const url = await presignGetUrl({ key: fileRow.r2_key, expiresSeconds: GET_URL_EXPIRES_SECONDS });
    const response = NextResponse.redirect(url);
    applyNoStoreHeaders(response.headers);
    response.headers.set("x-request-id", requestId);
    response.headers.set("x-gom-request-id", requestId);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonErrorWithRequestId("DOWNLOAD_FAILED", message, requestId, 400, undefined, withNoStoreHeaders());
  }
}
