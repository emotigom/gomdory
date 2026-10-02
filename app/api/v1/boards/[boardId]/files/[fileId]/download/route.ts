import { NextResponse } from "next/server";

import { applyNoStoreHeaders, withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { requireUser } from "@/lib/auth/requireUser";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { getBoardFileReadUrl } from "@/lib/data/boardFiles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ boardId: string; fileId: string }> },
) {
  const requestId = getOrCreateRequestId(req);

  try {
    const { boardId, fileId } = await params;
    const { user } = await requireUser(`/dashboard/boards/${boardId}/files`);
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("board_files")
      .select("id, r2_key, board_id, owner_id")
      .eq("id", fileId)
      .eq("owner_id", user.id)
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("파일을 찾을 수 없습니다.");
    }

    const url = await getBoardFileReadUrl(data.r2_key);
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
