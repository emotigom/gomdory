import { NextRequest } from "next/server";
import { toCamelKeys } from "@/lib/standards/fields";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getEduJoinSessionSafe } from "@/lib/edu/joinSession";
import { isLikelyShareCode, normalizeShareCode } from "@/lib/student/shareCode";

type GalleryRow = { id: string; title: string | null; publishedAt: string | null };
const error = (status: number, code: string, message: string) => Response.json({ ok: false, error: { code, message } }, { status, headers: { "cache-control": "no-store" } });
const STUDENT_APP_PUBLIC_BASE_URL = "https://eduview.gkrry.com";
const MAX_GALLERY_APPS = 50;
const publicUrlFor = (id: string) => `${STUDENT_APP_PUBLIC_BASE_URL}/apps/${encodeURIComponent(id)}/`;

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return error(400, "invalid_body", "요청 형식이 올바르지 않습니다."); }
  if (!body || typeof body !== "object" || !("boardId" in body) || typeof body.boardId !== "string") return error(400, "board_id_required", "boardId가 필요합니다.");
  const payload = body as { boardId: string; shareCode?: string | null; accessCode?: string | null; guestToken?: string | null; studentSessionToken?: string | null };
  const shareCode = normalizeShareCode(typeof payload.shareCode === "string" ? payload.shareCode : typeof payload.accessCode === "string" ? payload.accessCode : "");
  const sessionToken = typeof payload.studentSessionToken === "string" ? payload.studentSessionToken.trim() : typeof payload.guestToken === "string" ? payload.guestToken.trim() : "";
  if (!shareCode && !sessionToken) return error(400, "access_required", "공유코드 또는 학생 입장 세션이 필요합니다.");

  const supabase = createSupabaseAdminClient();
  const boardRes = await supabase.from("boards").select("id, share_code, share_enabled").eq("id", payload.boardId).maybeSingle();
  if (boardRes.error || !boardRes.data?.id) return error(404, "board_not_found", "보드를 찾을 수 없습니다.");
  const board = toCamelKeys(boardRes.data as Record<string, unknown>) as { id: string; shareCode: string | null; shareEnabled: boolean | null };
  if (sessionToken) {
    const session = await getEduJoinSessionSafe(sessionToken);
    if (session.state !== "resolved" || !session.session?.shareCode || !session.session?.boardId || session.session.boardId !== payload.boardId) return error(403, "invalid_board_access", "유효한 학생 입장 세션이 아닙니다.");
  } else {
    if (!isLikelyShareCode(shareCode)) return error(400, "access_required", "유효한 공유코드가 필요합니다.");
    const boardShareMatches = normalizeShareCode(board.shareCode ?? "") === shareCode && board.shareEnabled === true;
    if (!boardShareMatches) {
      const joinCodeRes = await supabase.from("edu_join_codes").select("code, board_id, is_active, revoked_at").eq("code", shareCode).eq("board_id", payload.boardId).eq("is_active", true).is("revoked_at", null).maybeSingle();
      const joinCode = joinCodeRes.data ? toCamelKeys(joinCodeRes.data as Record<string, unknown>) as { code: string; boardId: string } : null;
      if (joinCodeRes.error || !joinCode?.boardId) return error(403, "invalid_board_access", "보드 접근 코드가 유효하지 않습니다.");
    }
  }

  const deploymentsRes = await supabase
    .from("student_app_deployments")
    .select("id, title, published_at")
    .eq("board_id", payload.boardId)
    .eq("status", "published")
    .is("deleted_at", null)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(MAX_GALLERY_APPS);
  if (deploymentsRes.error) return error(500, "internal_error", "요청을 처리하지 못했습니다.");

  const apps = (deploymentsRes.data ?? []).map((rawRow) => {
    const row = toCamelKeys(rawRow as Record<string, unknown>) as GalleryRow;
    return ({
    id: row.id,
    title: row.title,
    authorLabel: "친구 작품",
    publishedAt: row.publishedAt,
    displayUrl: publicUrlFor(row.id),
  });
  });
  return Response.json({ ok: true, apps }, { headers: { "cache-control": "no-store" } });
}
