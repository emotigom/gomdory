import { NextResponse } from "next/server";

import { applyNoStoreHeaders, withNoStoreHeaders } from "@/lib/api/server/noStoreHeaders";
import { jsonErrorWithRequestId } from "@/lib/api/server/response";
import { getBoardByShareCode, normalizeShareCode } from "@/lib/data/share";
import { getOrCreateRequestId } from "@/lib/http/requestId";
import { presignGetUrl } from "@/lib/r2/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  SHARE_DB_COLUMNS,
  shareBoardFileSelect,
  shareCardWallSelect,
  shareLegacyFileSelect,
  shareLinkedCardFileSelect,
  shareWallSelect,
} from "@/lib/db/shareQueries";

const GET_URL_EXPIRES_SECONDS = 600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string; fileId: string }> },
) {
  const requestId = getOrCreateRequestId(request);
  const { code, fileId } = await params;
  const normalizedCode = normalizeShareCode(code);
  const board = await getBoardByShareCode(normalizedCode);

  if (!board) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const supabase = createSupabaseAdminClient();

  const { data: boardFile, error: boardFileError } = await supabase
    .from("board_files")
    .select(shareBoardFileSelect)
    .eq("id", fileId)
    .is(SHARE_DB_COLUMNS.deletedAt, null)
    .maybeSingle();

  if (boardFileError && boardFileError.code !== "PGRST116") {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const boardFileRow = boardFile as { id: string; boardId: string; r2Key: string; deletedAt: string | null } | null;

  if (boardFileRow) {
    const { data: linkedCardFileRaw, error: linkedCardFilesError } = await supabase
      .from("card_files")
      .select(shareLinkedCardFileSelect)
      .eq(SHARE_DB_COLUMNS.boardFileId, fileId)
      .is(SHARE_DB_COLUMNS.deletedAt, null)
      .limit(1)
      .maybeSingle();

    if (linkedCardFilesError || !linkedCardFileRaw) {
      return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
    }

    const linkedCardFiles = linkedCardFileRaw as unknown as {
      card: { id: string; wallId: string; deletedAt: string | null } | null;
      boardFile: { id: string; boardId: string; deletedAt: string | null } | null;
    };

    const card = linkedCardFiles.card;
    const linkedBoardFile = linkedCardFiles.boardFile;

    if (!card || card.deletedAt || !linkedBoardFile || linkedBoardFile.deletedAt || linkedBoardFile.boardId !== board.id) {
      return jsonErrorWithRequestId("FORBIDDEN", "Forbidden", requestId, 403, undefined, withNoStoreHeaders());
    }

    const { data: wall, error: wallError } = await supabase
      .from("walls")
      .select(shareWallSelect)
      .eq("id", card.wallId)
      .maybeSingle();

    const boardWall = wall as { id: string; boardId: string } | null;

    if (wallError || !boardWall || boardWall.boardId !== board.id) {
      return jsonErrorWithRequestId("FORBIDDEN", "Forbidden", requestId, 403, undefined, withNoStoreHeaders());
    }

    const signedUrl = await presignGetUrl({
      key: boardFileRow.r2Key,
      expiresSeconds: GET_URL_EXPIRES_SECONDS,
    });

    const res = NextResponse.redirect(signedUrl);
    applyNoStoreHeaders(res.headers);
    res.headers.set("x-request-id", requestId);
    res.headers.set("x-gom-request-id", requestId);
    return res;
  }

  const { data: file, error: fileError } = await supabase
    .from("files")
    .select(shareLegacyFileSelect)
    .eq("id", fileId)
    .maybeSingle();

  if (fileError) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const fileRow = file as
    | { id: string; cardId: string; r2Key: string; status: string; deletedAt: string | null }
    | null;

  if (!fileRow || fileRow.status !== "ready" || fileRow.deletedAt) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const { data: card, error: cardError } = await supabase
    .from("cards")
    .select(shareCardWallSelect)
    .eq("id", fileRow.cardId)
    .maybeSingle();

  if (cardError) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const cardRow = card as { id: string; wallId: string; deletedAt: string | null } | null;

  if (!cardRow || cardRow.deletedAt) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const { data: wall, error: wallError } = await supabase
    .from("walls")
    .select(shareWallSelect)
    .eq("id", cardRow.wallId)
    .maybeSingle();

  if (wallError) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  const wallRow = wall as { id: string; boardId: string } | null;

  if (!wallRow) {
    return jsonErrorWithRequestId("NOT_FOUND", "Not found", requestId, 404, undefined, withNoStoreHeaders());
  }

  if (wallRow.boardId !== board.id) {
    return jsonErrorWithRequestId("FORBIDDEN", "Forbidden", requestId, 403, undefined, withNoStoreHeaders());
  }

  const signedUrl = await presignGetUrl({
    key: fileRow.r2Key,
    expiresSeconds: GET_URL_EXPIRES_SECONDS,
  });

  const res = NextResponse.redirect(signedUrl);
  applyNoStoreHeaders(res.headers);
  res.headers.set("x-request-id", requestId);
  res.headers.set("x-gom-request-id", requestId);
  return res;
}
