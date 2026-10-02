import { notFound } from "next/navigation";

import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { requireUser } from "@/lib/auth/requireUser";
import { getBoard } from "@/lib/data/boards.server";
import { loadLessonRunDiagnostics } from "@/lib/lesson-run/loadLessonRunDiagnostics";
import { resolveLessonRunState } from "@/lib/lesson-run/resolveLessonRunState";
import { toLessonRunInput, toStartLessonRunPreviewInput } from "@/lib/lesson-run/toLessonRunInput";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import LessonRunDiagnosticsClient from "./LessonRunDiagnosticsClient";

export const dynamic = "force-dynamic";

export default async function LessonRunDiagnosticsPage({
  params,
}: {
  params: Promise<{ boardId: string }>;
}) {
  const { boardId } = await params;
  const returnTo = `/dashboard/boards/${boardId}/lesson-run-diagnostics`;
  const { user } = await requireUser(returnTo);
  const { board } = await getBoard(boardId, { userId: user.id });

  if (!board) {
    return notFound();
  }

  const supabase = createSupabaseServerClient();
  const { data: roleResult } = await supabase.rpc("board_role", { bid: board.id });
  const role = normalizeBoardRole(roleResult);
  if (!canEditBoard(role)) {
    return notFound();
  }

  const now = new Date().toISOString();
  const snapshot = await loadLessonRunDiagnostics(board.id);
  const { input, diagnosticsWarnings } = toLessonRunInput(snapshot, now);
  const state = resolveLessonRunState(input);
  const dryRunInput = toStartLessonRunPreviewInput({
    lessonRunInput: input,
    lessonRunState: state,
    now,
    requestedPreset: "45m",
    teacher: {
      role,
      canEditBoard: canEditBoard(role),
      canStartLessonRun: canEditBoard(role),
    },
  });

  return (
    <LessonRunDiagnosticsClient
      boardId={board.id}
      now={now}
      state={state}
      snapshot={snapshot}
      diagnosticsWarnings={diagnosticsWarnings}
      dryRunInput={dryRunInput}
    />
  );
}
