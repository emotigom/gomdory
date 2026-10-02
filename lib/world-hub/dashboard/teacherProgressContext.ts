import { getLocalWorldHubManifestSnapshot } from "@/lib/world-hub/manifest/localManifestSnapshot";
import {
  parseTeacherDashboardMetaverseContext,
  type TeacherDashboardMetaverseContext,
  type TeacherDashboardStudentReference,
} from "@/lib/world-hub/dashboard/contracts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type MinimalSupabase = Pick<ReturnType<typeof createSupabaseAdminClient>, "from">;

type BoardMemberRow = {
  user_id: string | null;
  created_at: string | null;
};

function formatPrivacySafeStudentLabel(index: number) {
  return `Student ${String(index + 1).padStart(2, "0")}`;
}

function compareBoardMembers(left: BoardMemberRow, right: BoardMemberRow) {
  const leftCreatedAt = left.created_at ?? "";
  const rightCreatedAt = right.created_at ?? "";

  if (leftCreatedAt !== rightCreatedAt) {
    return leftCreatedAt.localeCompare(rightCreatedAt);
  }

  return (left.user_id ?? "").localeCompare(right.user_id ?? "");
}

function resolveStudentReferences(args: {
  rows: BoardMemberRow[];
  ownerUserId?: string | null;
}): TeacherDashboardStudentReference[] {
  const uniqueStudentIds = [...args.rows]
    .filter((row) => row.user_id && row.user_id !== args.ownerUserId)
    .sort(compareBoardMembers)
    .map((row) => row.user_id as string)
    .filter((studentId, index, entries) => entries.indexOf(studentId) === index);

  return uniqueStudentIds.map((studentId, index) => ({
    studentId,
    studentLabel: formatPrivacySafeStudentLabel(index),
  }));
}

export async function resolveTeacherDashboardMetaverseContext(args: {
  classId: string;
  boardIds: string[];
  ownerUserId?: string | null;
  worldId?: string;
  sessionId?: string | null;
  createAdminClientFn?: () => MinimalSupabase;
}): Promise<TeacherDashboardMetaverseContext> {
  const manifest = getLocalWorldHubManifestSnapshot();
  const worldId = args.worldId ?? manifest.worldId;
  const manifestSessionId = "sessionId" in manifest.bootstrap ? manifest.bootstrap.sessionId : null;
  const sessionId = args.sessionId ?? manifestSessionId ?? null;

  if (args.boardIds.length === 0) {
    return parseTeacherDashboardMetaverseContext({
      classId: args.classId,
      worldId,
      sessionId,
      students: [],
    });
  }

  const admin = args.createAdminClientFn ? args.createAdminClientFn() : createSupabaseAdminClient();
  const { data, error } = await admin
    .from("board_members")
    .select("user_id, created_at")
    .in("board_id", args.boardIds);

  if (error) {
    throw new Error(error.message ?? "Failed to resolve teacher metaverse student context.");
  }

  return parseTeacherDashboardMetaverseContext({
    classId: args.classId,
    worldId,
    sessionId,
    students: resolveStudentReferences({
      rows: (data ?? []) as BoardMemberRow[],
      ownerUserId: args.ownerUserId ?? null,
    }),
  });
}
