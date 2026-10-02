import Link from "next/link";
import { notFound } from "next/navigation";

import { normalizeBoardRole, type BoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { boardHubHref } from "@/lib/dashboard/boardHrefs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import AuditLogViewer from "./AuditLogViewer";

type AuditLogItem = {
  id: string;
  createdAt: string;
  action: string;
  targetType: string | null;
  targetId: string | null;
  actorUserId: string | null;
  actorRole: BoardRole | null;
  meta: Record<string, unknown>;
  requestId: string | null;
};

async function loadBoardTitle(boardId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("boards")
    .select("id, title")
    .eq("id", boardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function loadInitialLogs(boardId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select(
      "id, created_at, action, target_type, target_id, actor_user_id, actor_role, meta, request_id",
    )
    .eq("board_id", boardId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  const items = (data ?? []).map<AuditLogItem>((row) => ({
    id: row.id,
    createdAt: row.created_at,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    actorUserId: row.actor_user_id,
    actorRole: normalizeBoardRole(row.actor_role),
    meta: row.meta,
    requestId: row.request_id,
  }));

  const nextCursor = items.length === 50 ? items[items.length - 1]?.createdAt ?? null : null;

  return { items, nextCursor };
}

async function loadBoardRole(boardId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.rpc("board_role", { bid: boardId });
  return normalizeBoardRole(data);
}

export default async function AuditPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  await requireUser(`/dashboard/boards/${boardId}/audit`);

  const [board, role] = await Promise.all([loadBoardTitle(boardId), loadBoardRole(boardId)]);

  if (!board || !role) {
    return notFound();
  }

  const initialLogs = await loadInitialLogs(boardId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">감사 로그</p>
          <h1 className="text-2xl font-bold text-gray-900">{board.title}</h1>
        </div>
        <Link
          href={boardHubHref(boardId)}
          className="rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
        >
          보드로 돌아가기
        </Link>
      </div>

      <AuditLogViewer
        boardId={boardId}
        initialItems={initialLogs.items}
        initialCursor={initialLogs.nextCursor}
      />
    </div>
  );
}
