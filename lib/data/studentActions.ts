import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBoardByShareCode } from "@/lib/data/share";
import { upsertBoardLiveSession } from "@/lib/data/liveSession";
import { normalizeEventPayload } from "@/lib/data/sessionsReport";
import type {
  StudentActionKind,
  StudentActionHelpReason,
  StudentActionPulseValue,
  StudentActionRecord,
  StudentActionSummary,
  StudentActionTriageEntry,
  StudentActionTriageState,
} from "@/lib/types/studentActions";

const RECENT_LIMIT = 3;
const TRIAGE_LIMIT = 120;
const PULSE_SAMPLE_LIMIT = 120;
const PULSE_SAMPLE_WINDOW_MS = 5 * 60 * 1000;

function buildCounts(base?: StudentActionSummary["counts"]) {
  return {
    question: base?.question ?? 0,
    help: base?.help ?? 0,
    pulse: base?.pulse ?? 0,
  };
}

function mergeRecent(current: StudentActionRecord[], next: StudentActionRecord) {
  const merged = [next, ...current.filter((entry) => entry.id !== next.id)];
  return merged
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, RECENT_LIMIT);
}

function mergeTriage(
  current: StudentActionTriageEntry[],
  next: StudentActionTriageEntry,
) {
  const merged = [next, ...current.filter((entry) => entry.actionId !== next.actionId)];
  return merged
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, TRIAGE_LIMIT);
}

export async function recordStudentAction({
  shareCode,
  kind,
  text,
  reason,
  value,
  clientRequestId,
  createdAt,
  anonId,
  auditContext,
}: {
  shareCode: string;
  kind: StudentActionKind;
  text?: string | null;
  reason?: StudentActionHelpReason | null;
  value?: StudentActionPulseValue | null;
  clientRequestId: string;
  createdAt: number;
  anonId?: string | null;
  auditContext?: { ip?: string | null; userAgent?: string | null };
}): Promise<{ actionId: string; status: StudentActionTriageEntry["status"]; accepted: boolean; deduped?: boolean }> {
  const board = await getBoardByShareCode(shareCode);
  if (!board) {
    throw new Error("SHARE_NOT_FOUND");
  }

  const supabase = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await supabase
    .from("board_live_session")
    .select("snapshot")
    .eq("board_id", board.id)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  const snapshot =
    (existing?.snapshot as {
      studentActions?: StudentActionSummary;
      studentActionTriage?: StudentActionTriageState;
      studentHudSettings?: { approvalMode?: "auto" | "teacher_approve" };
      activeSessionId?: string | null;
    }) ?? null;

  const existingTriage =
    snapshot?.studentActionTriage?.actions.find((entry) => entry.actionId === clientRequestId) ?? null;
  if (existingTriage) {
    return { actionId: clientRequestId, status: existingTriage.status, accepted: false, deduped: true };
  }

  const existingActions = snapshot?.studentActions;
  const counts = buildCounts(existingActions?.counts);
  counts[kind] += 1;

  const entry: StudentActionRecord = {
    id: clientRequestId,
    kind,
    text: text ?? null,
    reason: reason ?? null,
    value: value ?? null,
    createdAt,
  };

  const recent = mergeRecent(existingActions?.recent ?? [], entry);
  let pulseSummary = existingActions?.pulse;
  const cutoff = createdAt - PULSE_SAMPLE_WINDOW_MS;
  if (pulseSummary?.samples?.length) {
    const filtered = pulseSummary.samples.filter((sample) => sample.createdAt >= cutoff);
    if (filtered.length !== pulseSummary.samples.length) {
      const total = filtered.reduce((sum, sample) => sum + sample.value, 0);
      pulseSummary = {
        ...pulseSummary,
        samples: filtered,
        count: filtered.length,
        average: filtered.length ? total / filtered.length : 0,
      };
    }
  }
  if (kind === "pulse" && typeof value === "number") {
    const existingSamples = pulseSummary?.samples ?? [];
    const nextSamples = [...existingSamples, { value, createdAt }]
      .filter((sample) => sample.createdAt >= cutoff)
      .slice(-PULSE_SAMPLE_LIMIT);
    const total = nextSamples.reduce((sum, sample) => sum + sample.value, 0);
    pulseSummary = {
      samples: nextSamples,
      count: nextSamples.length,
      average: nextSamples.length ? total / nextSamples.length : 0,
    };
  }

  const studentActions: StudentActionSummary = {
    counts,
    recent,
    pulse: pulseSummary,
    updatedAt: createdAt,
  };

  const approvalMode = snapshot?.studentHudSettings?.approvalMode ?? "auto";
  const nextStatus = approvalMode === "teacher_approve" ? "pending" : "approved";
  const triageEntry: StudentActionTriageEntry = {
    actionId: clientRequestId,
    kind,
    text: text ?? null,
    reason: reason ?? null,
    value: value ?? null,
    createdAt,
    status: nextStatus,
    updatedAt: createdAt,
  };
  const triageState: StudentActionTriageState = {
    actions: mergeTriage(snapshot?.studentActionTriage?.actions ?? [], triageEntry),
    updatedAt: createdAt,
  };

  await upsertBoardLiveSession(
    board.id,
    {
      studentActions,
      studentActionTriage: triageState,
      ts: Date.now(),
    },
    { useServiceRole: true },
  );

  const activeSessionId = snapshot?.activeSessionId ?? null;
  if (activeSessionId) {
    const payload = normalizeEventPayload("student_action", {
      actionId: clientRequestId,
      kind,
      text,
      reason,
      value,
      createdAt,
      anonId,
    });

    const { error } = await supabase.from("class_session_events").insert({
      session_id: activeSessionId,
      board_id: board.id,
      share_code: shareCode,
      type: "student_action",
      payload,
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  await supabase.from("audit_logs").insert({
    board_id: board.id,
    actor_user_id: null,
    actor_role: null,
    action: "student_action.submitted",
    target_type: "student_action",
    target_id: clientRequestId,
    meta: {
      kind,
      shareCode,
    },
    ip: auditContext?.ip ?? null,
    user_agent: auditContext?.userAgent ?? null,
  });

  return { actionId: clientRequestId, status: nextStatus, accepted: true };
}
