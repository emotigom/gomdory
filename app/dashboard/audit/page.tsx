import { requireUser } from "@/lib/auth/requireUser";
import { routes } from "@/lib/standards/routes";
import { listBoardsForUser } from "@/lib/data/boards.server";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AuditOverviewClient from "./AuditOverviewClient";

export const dynamic = "force-dynamic";

export type AuditOverviewItem = {
  id: string;
  createdAt: string;
  boardId: string | null;
  actorUserId: string | null;
  actorRole: ReturnType<typeof normalizeBoardRole>;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown>;
  requestId: string | null;
};

async function loadInitialLogs(boardIds: string[], userId: string) {
  const supabase = createSupabaseServerClient();
  let query = supabase
    .from("audit_logs")
    .select(
      "id, created_at, board_id, actor_user_id, actor_role, action, target_type, target_id, meta, request_id",
    )
    .order("created_at", { ascending: false })
    .limit(201);

  if (boardIds.length) {
    const idList = boardIds.join(",");
    query = query.or(`board_id.in.(${idList}),and(board_id.is.null,actor_user_id.eq.${userId})`);
  } else {
    query = query.eq("actor_user_id", userId).is("board_id", null);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).slice(0, 200).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    boardId: row.board_id,
    actorUserId: row.actor_user_id,
    actorRole: normalizeBoardRole(row.actor_role),
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    meta: row.meta,
    requestId: row.request_id,
  }));

  return items;
}

export default async function AuditOverviewPage() {
  const { user } = await requireUser(routes.page.dashboard.audit());
  const supabase = createSupabaseServerClient();
  const boards = await listBoardsForUser({ supabase, userId: user.id });
  const boardOptions = boards.map((board) => ({ id: board.id, title: board.title }));
  const initialItems = await loadInitialLogs(
    boardOptions.map((board) => board.id),
    user.id,
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-gray-500">감사 로그</p>
        <h1 className="text-2xl font-bold text-gray-900">최근 활동</h1>
      </div>
      <AuditOverviewClient boards={boardOptions} initialItems={initialItems} />
    </div>
  );
}
