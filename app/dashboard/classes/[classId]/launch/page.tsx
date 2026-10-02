import { notFound, redirect } from "next/navigation";

import PageMarker from "@/app/_components/PageMarker";
import { requireUser } from "@/lib/auth/requireUser";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildShareUrl, buildStudentUrl } from "@/lib/http/publicLinks";
import { generateShareCode, isValidShareCode, normalizeShareCode } from "@/lib/data/share";
import LaunchpadClient from "./LaunchpadClient";

export const dynamic = "force-dynamic";

type LaunchpadBoard = { id: string; title: string; share_code: string | null; class_id?: string };
type LaunchpadSession = { id: string; startedAt: string; endedAt: string | null; shareCode: string | null; lessonTemplateId: string | null } | null;

async function ensureBoardShareCode(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  board: LaunchpadBoard,
  ownerId: string,
  classId: string,
): Promise<string | null> {
  const existing = board.share_code;
  const normalized =
    existing && isValidShareCode(existing) ? normalizeShareCode(existing) : generateShareCode();

  if (normalized === existing) {
    return normalized;
  }

  const { error } = await supabase
    .from("boards")
    .update({ share_code: normalized })
    .eq("id", board.id)
    .eq("owner_id", ownerId)
    .eq("class_id", classId);

  if (error) {
    console.error("Failed to ensure board share code", error.message);
  }

  return normalized;
}

async function loadLaunchpadData(classId: string, userId: string) {
  const supabase = createSupabaseServerClient();

  const { data: classRow, error: classError } = await supabase
    .from("classes")
    .select("id, title, short_code, active_board_id")
    .eq("id", classId)
    .eq("owner_id", userId)
    .maybeSingle();

  if (classError) {
    throw new Error(classError.message);
  }

  if (!classRow) {
    return null;
  }

  let activeBoard: LaunchpadBoard | null = null;
  let shareCode: string | null = null;

  if (classRow.active_board_id) {
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id, title, share_code, class_id")
      .eq("id", classRow.active_board_id)
      .eq("owner_id", userId)
      .maybeSingle();

    if (boardError) {
      throw new Error(boardError.message);
    }

    if (board) {
      activeBoard = board as LaunchpadBoard;
      shareCode = await ensureBoardShareCode(supabase, activeBoard, userId, classId);
    }
  }

  const { data: session, error: sessionError } = await supabase
    .from("class_sessions")
    .select("id, started_at, ended_at, share_code, lesson_template_id")
    .eq("class_id", classId)
    .eq("created_by", userId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    throw new Error(sessionError.message);
  }

  const normalizedSession: LaunchpadSession = session
    ? {
        id: session.id as string,
        startedAt: session.started_at as string,
        endedAt: (session.ended_at as string | null) ?? null,
        shareCode: (session.share_code as string | null) ?? null,
        lessonTemplateId: (session.lesson_template_id as string | null) ?? null,
      }
    : null;

  const resolvedShareCode = shareCode ?? normalizedSession?.shareCode ?? null;
  const studentUrl = classRow.short_code
    ? buildStudentUrl(`/k/${classRow.short_code}`)
    : resolvedShareCode
      ? buildShareUrl(resolvedShareCode)
      : null;
  return {
    classTitle: classRow.title as string,
    classShortCode: (classRow.short_code as string | null) ?? null,
    activeBoardId: (classRow.active_board_id as string | null) ?? null,
    activeBoardTitle: activeBoard?.title ?? null,
    shareCode: resolvedShareCode,
    studentUrl,
    session: normalizedSession,
    activeLessonTemplateId: normalizedSession?.lessonTemplateId ?? null,
  };
}

export default async function LaunchpadPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;

  if (!classId) {
    redirect("/dashboard");
  }

  const { user } = await requireUser(`/dashboard/classes/${classId}/launch`);
  const data = await loadLaunchpadData(classId, user.id);

  if (!data) {
    return notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50/60 pb-12">
      <PageMarker page="dashboard" view="class-launchpad" extra={{ classId }} />
      <div data-page-marker="class-launchpad" className="sr-only" />
      <LaunchpadClient
        classId={classId}
        classTitle={data.classTitle}
        classShortCode={data.classShortCode}
        activeBoardId={data.activeBoardId}
        activeBoardTitle={data.activeBoardTitle}
        initialShareCode={data.shareCode}
        initialSession={data.session}
        activeLessonTemplateId={data.activeLessonTemplateId}
      />
    </div>
  );
}
