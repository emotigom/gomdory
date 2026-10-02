import { notFound } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import { normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { getSession } from "@/lib/data/sessionsReport";
import type { SessionReport } from "@/lib/types/sessionReport";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import ReplayClient from "./ReplayClient";

export default async function SessionReplayPage({
  params,
}: {
  params: Promise<{ boardId: string; sessionId: string }>;
}) {
  const { boardId, sessionId } = await params;
  await requireUser(`/dashboard/boards/${boardId}`);

  const supabase = createSupabaseServerClient();
  const { data: role, error: roleError } = await supabase.rpc("board_role", { bid: boardId });
  const boardRole = normalizeBoardRole(role);

  if (roleError || !boardRole || boardRole === "viewer") {
    return notFound();
  }

  const { session, events } = await getSession({ boardId, sessionId });
  if (!session) {
    return notFound();
  }

  const report = session.report as SessionReport | null;
  const hasLiveSession = session.status === "running";

  return (
    <div className="space-y-6">
      <PageMarker page="dashboard" view="replay" extra={{ report: "replay" }} />
      <div data-page-marker="dashboard_replay" className="sr-only" />
      <ReplayClient
        boardId={boardId}
        sessionId={sessionId}
        session={session}
        report={report}
        events={events}
        hasLiveSession={hasLiveSession}
      />
    </div>
  );
}
