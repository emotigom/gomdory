import type { SupabaseClient } from "@supabase/supabase-js";
import { ZodError } from "zod";

import {
  parseMetaverseProgressRow,
  type MetaverseProgressRow,
} from "@/lib/world-hub/progress/persistenceRows";
import {
  parseTeacherDashboardMetaverseContext,
  parseTeacherDashboardMetaverseSummary,
  type TeacherDashboardAggregateMetadata,
  type TeacherDashboardMetaverseContext,
  type TeacherDashboardMetaverseProgressPort,
  type TeacherDashboardMetaverseSource,
  type TeacherDashboardMetaverseSummary,
  type TeacherDashboardMissionAggregate,
  type TeacherDashboardRecentMissionCompletion,
  type TeacherDashboardStudentActivity,
  type TeacherDashboardWorldAggregate,
} from "@/lib/world-hub/dashboard/contracts";

const METAVERSE_PROGRESS_TABLE = "metaverse_progress_snapshots";
const DEFAULT_ENDPOINT = "/world-hub/api/progress";
const DEFAULT_PREVIEW_WORLD_ID = "local-preview-world";

type MinimalSupabase = Pick<SupabaseClient, "from">;

type TableSelectResponse = {
  data: unknown[] | null;
  error: { message?: string | null } | null;
};

function getProgressTable(client: MinimalSupabase) {
  return client.from(METAVERSE_PROGRESS_TABLE as never) as unknown as {
    select(query: string): {
      in(column: string, values: string[]): Promise<TableSelectResponse>;
    };
  };
}

function compareIsoDesc(left: string | null, right: string | null) {
  if (left === right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return right.localeCompare(left);
}

function createPreviewSummary(args?: {
  classroom?: TeacherDashboardMetaverseContext | null;
  detail?: string;
  fallbackReason?: TeacherDashboardMetaverseSource["fallbackReason"];
}): TeacherDashboardMetaverseSummary {
  const classroom = args?.classroom
    ? parseTeacherDashboardMetaverseContext(args.classroom)
    : {
        classId: null,
        worldId: DEFAULT_PREVIEW_WORLD_ID,
        sessionId: null,
        students: [],
      };

  const studentActivity: TeacherDashboardStudentActivity[] = classroom.students.map((student) => ({
    studentId: student.studentId,
    studentLabel: student.studentLabel,
    status: "no-activity",
    lastActivityAtIso: null,
    worldId: null,
    sessionId: null,
    missionId: null,
    missionTitle: null,
    persistenceStatus: null,
  }));

  return parseTeacherDashboardMetaverseSummary({
    version: 1,
    state: "empty",
    scope: {
      classId: classroom.classId,
      worldId: classroom.worldId,
      sessionId: classroom.sessionId,
      studentCount: classroom.students.length,
      context: "preview-fallback",
    },
    recentMissionCompletions: [],
    studentActivity,
    aggregates: {
      studentCount: classroom.students.length,
      activeStudentCount: 0,
      completionCount: 0,
      latestActivityAtIso: null,
      missions: [],
      worlds: [],
    },
    source: {
      kind: "deterministic-local-preview",
      label: "Deterministic local teacher summary",
      detail:
        args?.detail ??
        "Classroom context is unavailable, so the teacher progress adapter returned a deterministic local preview summary.",
      fallbackReason: args?.fallbackReason ?? "classroom-context-unavailable",
      diagnostics: {
        mode: "local-preview",
        endpoint: null,
        classroomContext: classroom.classId ? "preview" : "missing",
        queriedStudentCount: classroom.students.length,
        matchedStudentCount: 0,
        readStatus: "fallback",
        syncedAtIso: null,
      },
    },
  });
}

function createSupabaseSource(args: {
  detail: string;
  queriedStudentCount: number;
  matchedStudentCount: number;
  syncedAtIso: string | null;
}): TeacherDashboardMetaverseSource {
  return {
    kind: "supabase-class-summary",
    label: "Supabase metaverse class summary",
    detail: args.detail,
    fallbackReason: null,
    diagnostics: {
      mode: "supabase",
      endpoint: DEFAULT_ENDPOINT,
      classroomContext: "resolved",
      queriedStudentCount: args.queriedStudentCount,
      matchedStudentCount: args.matchedStudentCount,
      readStatus: "succeeded",
      syncedAtIso: args.syncedAtIso,
    },
  };
}

function resolveRecentMissionCompletions(args: {
  classroom: TeacherDashboardMetaverseContext;
  rows: MetaverseProgressRow[];
}): TeacherDashboardRecentMissionCompletion[] {
  const studentsById = new Map(args.classroom.students.map((student) => [student.studentId, student]));

  return [...args.rows]
    .sort((left, right) => compareIsoDesc(left.recent_completion.completedAtIso, right.recent_completion.completedAtIso))
    .map((row) => {
      const student = studentsById.get(row.user_id);
      return {
        studentId: row.user_id,
        studentLabel: student?.studentLabel ?? "Student",
        worldId: row.last_completed_mission.worldId,
        sessionId: row.last_completed_mission.sessionId,
        missionId: row.recent_completion.missionId,
        missionTitle: row.recent_completion.missionTitle,
        completedAtIso: row.recent_completion.completedAtIso,
        completionLabel: row.recent_completion.completionLabel,
        percentComplete: row.recent_completion.percentComplete,
        resultLabel: row.recent_completion.resultLabel,
        persistenceStatus: row.last_completed_mission.persistenceStatus,
      };
    });
}

function resolveStudentActivity(args: {
  classroom: TeacherDashboardMetaverseContext;
  rows: MetaverseProgressRow[];
}): TeacherDashboardStudentActivity[] {
  const rowsByStudentId = new Map(args.rows.map((row) => [row.user_id, row]));

  return args.classroom.students.map((student) => {
    const row = rowsByStudentId.get(student.studentId);
    if (!row) {
      return {
        studentId: student.studentId,
        studentLabel: student.studentLabel,
        status: "no-activity",
        lastActivityAtIso: null,
        worldId: null,
        sessionId: null,
        missionId: null,
        missionTitle: null,
        persistenceStatus: null,
      } satisfies TeacherDashboardStudentActivity;
    }

    return {
      studentId: student.studentId,
      studentLabel: student.studentLabel,
      status: "active",
      lastActivityAtIso: row.recent_completion.completedAtIso,
      worldId: row.last_completed_mission.worldId,
      sessionId: row.last_completed_mission.sessionId,
      missionId: row.recent_completion.missionId,
      missionTitle: row.recent_completion.missionTitle,
      persistenceStatus: row.last_completed_mission.persistenceStatus,
    } satisfies TeacherDashboardStudentActivity;
  });
}

function resolveMissionAggregates(completions: TeacherDashboardRecentMissionCompletion[]): TeacherDashboardMissionAggregate[] {
  const aggregates = new Map<string, TeacherDashboardMissionAggregate & { studentIds: Set<string> }>();

  for (const completion of completions) {
    const existing = aggregates.get(completion.missionId);
    if (existing) {
      existing.completionCount += 1;
      existing.studentIds.add(completion.studentId);
      if (compareIsoDesc(completion.completedAtIso, existing.latestCompletedAtIso) < 0) {
        existing.latestCompletedAtIso = completion.completedAtIso;
      }
      continue;
    }

    aggregates.set(completion.missionId, {
      missionId: completion.missionId,
      missionTitle: completion.missionTitle,
      completionCount: 1,
      uniqueStudentCount: 1,
      latestCompletedAtIso: completion.completedAtIso,
      studentIds: new Set([completion.studentId]),
    });
  }

  return [...aggregates.values()]
    .map(({ studentIds, ...aggregate }) => ({
      ...aggregate,
      uniqueStudentCount: studentIds.size,
    }))
    .sort((left, right) => compareIsoDesc(left.latestCompletedAtIso, right.latestCompletedAtIso));
}

function resolveWorldAggregates(completions: TeacherDashboardRecentMissionCompletion[]): TeacherDashboardWorldAggregate[] {
  const aggregates = new Map<string, TeacherDashboardWorldAggregate & { studentIds: Set<string> }>();

  for (const completion of completions) {
    const worldId = completion.worldId ?? DEFAULT_PREVIEW_WORLD_ID;
    const existing = aggregates.get(worldId);
    if (existing) {
      existing.completionCount += 1;
      existing.studentIds.add(completion.studentId);
      if (compareIsoDesc(completion.completedAtIso, existing.latestCompletedAtIso) < 0) {
        existing.latestCompletedAtIso = completion.completedAtIso;
      }
      continue;
    }

    aggregates.set(worldId, {
      worldId,
      completionCount: 1,
      uniqueStudentCount: 1,
      latestCompletedAtIso: completion.completedAtIso,
      studentIds: new Set([completion.studentId]),
    });
  }

  return [...aggregates.values()]
    .map(({ studentIds, ...aggregate }) => ({
      ...aggregate,
      uniqueStudentCount: studentIds.size,
    }))
    .sort((left, right) => compareIsoDesc(left.latestCompletedAtIso, right.latestCompletedAtIso));
}

function resolveAggregateMetadata(args: {
  classroom: TeacherDashboardMetaverseContext;
  recentMissionCompletions: TeacherDashboardRecentMissionCompletion[];
  studentActivity: TeacherDashboardStudentActivity[];
}): TeacherDashboardAggregateMetadata {
  const latestActivityAtIso = args.studentActivity
    .map((entry) => entry.lastActivityAtIso)
    .filter((value): value is string => Boolean(value))
    .sort(compareIsoDesc)[0] ?? null;

  return {
    studentCount: args.classroom.students.length,
    activeStudentCount: args.studentActivity.filter((entry) => entry.status === "active").length,
    completionCount: args.recentMissionCompletions.length,
    latestActivityAtIso,
    missions: resolveMissionAggregates(args.recentMissionCompletions),
    worlds: resolveWorldAggregates(args.recentMissionCompletions),
  };
}

export async function readTeacherDashboardMetaverseSummary(args: {
  classroom?: TeacherDashboardMetaverseContext | null;
  createAdminClientFn?: () => MinimalSupabase;
}): Promise<TeacherDashboardMetaverseSummary> {
  const classroom = args.classroom ? parseTeacherDashboardMetaverseContext(args.classroom) : null;

  if (!classroom || classroom.students.length === 0) {
    return createPreviewSummary({
      classroom,
      detail:
        "Teacher dashboard progress stayed on deterministic local fallback because class-scoped student context is unavailable.",
      fallbackReason: "classroom-context-unavailable",
    });
  }

  try {
    const envReady = (await import("@/lib/env/appConfig")).readSupabaseCanonicalClientEnvReady();
    if (!envReady && !args.createAdminClientFn) {
      return createPreviewSummary({
        classroom,
        detail:
          "Teacher dashboard progress stayed on deterministic local fallback because Supabase environment variables are unavailable in this preview.",
        fallbackReason: "env-missing",
      });
    }

    const admin = args.createAdminClientFn ? args.createAdminClientFn() : (await import("@/lib/supabase/admin")).createSupabaseAdminClient();
    const table = getProgressTable(admin);
    const { data, error } = await table
      .select("user_id, world_id, recent_completion, last_completed_mission, updated_at")
      .in("user_id", classroom.students.map((student) => student.studentId));

    if (error) {
      throw new Error(error.message ?? "Failed to read teacher dashboard metaverse summary.");
    }

    const rows = (data ?? []).map((row) => parseMetaverseProgressRow(row));
    const filteredRows = rows.filter((row) => row.world_id === classroom.worldId || row.last_completed_mission.worldId === classroom.worldId);
    const recentMissionCompletions = resolveRecentMissionCompletions({ classroom, rows: filteredRows });
    const studentActivity = resolveStudentActivity({ classroom, rows: filteredRows });
    const aggregates = resolveAggregateMetadata({
      classroom,
      recentMissionCompletions,
      studentActivity,
    });
    const syncedAtIso = filteredRows
      .map((row) => row.updated_at)
      .sort(compareIsoDesc)[0] ?? null;

    return parseTeacherDashboardMetaverseSummary({
      version: 1,
      state: recentMissionCompletions.length > 0 ? "ready" : "empty",
      scope: {
        classId: classroom.classId,
        worldId: classroom.worldId,
        sessionId: classroom.sessionId,
        studentCount: classroom.students.length,
        context: "classroom",
      },
      recentMissionCompletions,
      studentActivity,
      aggregates,
      source: createSupabaseSource({
        detail:
          recentMissionCompletions.length > 0
            ? `Loaded ${recentMissionCompletions.length} class-scoped metaverse progress summary record(s).`
            : "No class-scoped metaverse progress summary records matched the requested classroom scope.",
        queriedStudentCount: classroom.students.length,
        matchedStudentCount: filteredRows.length,
        syncedAtIso,
      }),
    });
  } catch (error) {
    return createPreviewSummary({
      classroom,
      detail:
        error instanceof ZodError
          ? "Teacher dashboard progress fell back to deterministic local preview because the persisted payload shape was invalid."
          : "Teacher dashboard progress fell back to deterministic local preview because the class summary read failed.",
      fallbackReason: error instanceof ZodError ? "invalid-payload" : "read-failed",
    });
  }
}

export function createTeacherDashboardMetaverseProgressAdapter(args?: {
  classroom?: TeacherDashboardMetaverseContext | null;
  createAdminClientFn?: () => MinimalSupabase;
}): TeacherDashboardMetaverseProgressPort {
  return {
    async readClassSummary(input) {
      return readTeacherDashboardMetaverseSummary({
        classroom: input?.classroom ?? args?.classroom ?? null,
        createAdminClientFn: args?.createAdminClientFn,
      });
    },
  };
}

export const localPreviewTeacherDashboardMetaverseProgress: TeacherDashboardMetaverseProgressPort = {
  async readClassSummary(args) {
    return createPreviewSummary({
      classroom: args.classroom ?? null,
      detail:
        "Teacher dashboard progress intentionally remained on deterministic local preview because classroom progress adapters are replaceable seams.",
      fallbackReason: "preview-mode",
    });
  },
};
