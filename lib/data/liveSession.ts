import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBoardByShareCode } from "@/lib/data/share";
import type { FlowStepActions } from "@/app/dashboard/flows";
import type { LiveEngagementState } from "@/lib/data/engagement";
import { sanitizeQuickPoll } from "@/lib/data/engagement";
import type { BoardControlsPublic } from "@/lib/types/boardControls";
import type { StudentActionSummary, StudentActionTriageState, StudentHudSettings } from "@/lib/types/studentActions";

export type LiveSnapshot = {
  boardId: string;
  activeSessionId?: string | null;
  activeSessionStartedAt?: string | null;
  flowId?: string;
  stepId?: string;
  stepIndex?: number;
  label?: string;
  target?: "class" | "share" | "present";
  safe?: boolean;
  focus?: boolean;
  pinnedQuestionId?: string | null;
  pinnedQuestionUpdatedAt?: number | null;
  qnaOpen?: boolean;
  qnaEndsAt?: number | null;
  qnaPrompt?: string | null;
  presenceNudgeAt?: number | null;
  pulse?: {
    ok: number;
    unsure: number;
    help: number;
    updatedAt: number;
  };
  poll?: {
    id: string;
    open: boolean;
    endsAt?: number | null;
    question: string;
    options: { id: string; label: string }[];
    counts?: Record<string, number>;
    total?: number;
    updatedAt: number;
  };
  currentStep?: {
    flowId: string;
    stepIndex: number;
    stepId: string;
    title?: string;
    prompt?: string;
    startedAt: number;
    seconds?: number;
    actions?: FlowStepActions;
    actionsApplied?: boolean;
    paused?: boolean;
    pausedAt?: number;
  };
  studentActions?: StudentActionSummary;
  studentActionTriage?: StudentActionTriageState;
  studentHudSettings?: StudentHudSettings;
  demoStepIndex?: number;
  ts: number;
  version?: number;
} & LiveEngagementState;

type LiveSessionRow = {
  board_id: string;
  snapshot: LiveSnapshot;
  version: number;
  updated_at: string;
};

export type LiveSnapshotShareable = Pick<
  LiveSnapshot,
  | "activeSessionId"
  | "activeSessionStartedAt"
  | "label"
  | "stepIndex"
  | "target"
  | "safe"
  | "focus"
  | "pinnedQuestionId"
  | "pinnedQuestionUpdatedAt"
  | "qnaOpen"
  | "qnaEndsAt"
  | "qnaPrompt"
  | "presenceNudgeAt"
  | "pulse"
  | "poll"
  | "quickPoll"
  | "reactions"
  | "spotlight"
  | "studentActions"
  | "studentActionTriage"
  | "studentHudSettings"
  | "demoStepIndex"
  | "currentStep"
  | "ts"
  | "version"
> & {
  controls?: BoardControlsPublic | null;
};

function normalizeLiveSnapshot(snapshot: LiveSnapshot): LiveSnapshot {
  return {
    ...snapshot,
    boardId: snapshot.boardId,
  };
}

function sanitizeTriageForShare(input: StudentActionTriageState | undefined): StudentActionTriageState | undefined {
  if (!input) return undefined;
  return {
    updatedAt: input.updatedAt,
    actions: input.actions.map((entry) => {
      const canReveal = entry.status === "approved" || entry.status === "pinned";
      return {
        actionId: entry.actionId,
        kind: entry.kind,
        text: canReveal ? (entry.text ?? null) : null,
        reason: canReveal ? (entry.reason ?? null) : null,
        createdAt: entry.createdAt,
        status: entry.status,
        handledAt: entry.handledAt ?? null,
        replyText: entry.replyText ?? null,
        updatedAt: entry.updatedAt,
      };
    }),
  };
}

function sanitizeLiveSnapshot(snapshot: LiveSnapshot, version: number): LiveSnapshotShareable {
  const quickPoll = sanitizeQuickPoll(snapshot.quickPoll ?? null);
  return {
    activeSessionId: snapshot.activeSessionId ?? null,
    activeSessionStartedAt: snapshot.activeSessionStartedAt ?? null,
    label: snapshot.label,
    stepIndex: snapshot.stepIndex,
    target: snapshot.target,
    safe: snapshot.safe,
    focus: snapshot.focus,
    pinnedQuestionId: snapshot.pinnedQuestionId ?? null,
    pinnedQuestionUpdatedAt: snapshot.pinnedQuestionUpdatedAt ?? null,
    qnaOpen: snapshot.qnaOpen,
    qnaEndsAt: snapshot.qnaEndsAt ?? null,
    qnaPrompt: snapshot.qnaPrompt ?? null,
    presenceNudgeAt: snapshot.presenceNudgeAt ?? null,
    pulse: snapshot.pulse,
    poll: snapshot.poll,
    currentStep: snapshot.currentStep,
    reactions: snapshot.reactions,
    quickPoll,
    spotlight: snapshot.spotlight ?? null,
    studentActions: snapshot.studentActions,
    studentActionTriage: sanitizeTriageForShare(snapshot.studentActionTriage),
    studentHudSettings: snapshot.studentHudSettings,
    demoStepIndex: snapshot.demoStepIndex,
    ts: snapshot.ts,
    version,
  };
}

export async function getBoardLiveSession(boardId: string): Promise<{
  snapshot: LiveSnapshot;
  version: number;
  updated_at: string;
} | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("board_live_session")
    .select("snapshot, version, updated_at")
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as LiveSessionRow | null;
  if (!row) return null;

  return {
    snapshot: normalizeLiveSnapshot(row.snapshot),
    version: row.version,
    updated_at: row.updated_at,
  };
}

export async function upsertBoardLiveSession(
  boardId: string,
  patchSnapshot: Partial<LiveSnapshot>,
  options?: { useServiceRole?: boolean },
): Promise<{ snapshot: LiveSnapshot; version: number }> {
  const supabase = options?.useServiceRole ? createSupabaseAdminClient() : createSupabaseServerClient();
  const { data: existing, error: existingError } = await supabase
    .from("board_live_session")
    .select("snapshot, version")
    .eq("board_id", boardId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const existingRow = existing as Pick<LiveSessionRow, "snapshot" | "version"> | null;
  const nextVersion = (existingRow?.version ?? 0) + 1;
  const mergedSnapshot: LiveSnapshot = {
    ...(existingRow?.snapshot ?? { boardId, ts: Date.now() }),
    ...patchSnapshot,
    boardId,
  };
  const nextSnapshot = { ...mergedSnapshot, version: nextVersion };

  const { data, error } = await supabase
    .from("board_live_session")
    .upsert(
      {
        board_id: boardId,
        snapshot: nextSnapshot,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "board_id" },
    )
    .select("snapshot, version")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as Pick<LiveSessionRow, "snapshot" | "version">;

  return {
    snapshot: normalizeLiveSnapshot(row.snapshot),
    version: row.version,
  };
}

export async function getBoardIdByShareCode(code: string): Promise<string | null> {
  const board = await getBoardByShareCode(code);
  return board?.id ?? null;
}

export async function getLiveSessionByShareCode(code: string): Promise<LiveSnapshotShareable | null> {
  const boardId = await getBoardIdByShareCode(code);
  if (!boardId) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("board_live_session")
    .select("snapshot, version")
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as Pick<LiveSessionRow, "snapshot" | "version"> | null;
  if (!row?.snapshot) return null;

  return sanitizeLiveSnapshot(row.snapshot, row.version);
}
