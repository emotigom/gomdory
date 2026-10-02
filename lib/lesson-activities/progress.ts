import "server-only";

import { createHash } from "node:crypto";

import {
  AI_BINGO_ACTIVITY_TYPE,
  AI_BINGO_REASON_MAX_LENGTH,
  buildInitialAiBingoState,
  buildLesson1AiBingoConfig,
  calculateAiBingoLines,
  isAiBingoConfig,
  normalizeAiBingoReason,
  tileExistsInAiBingoConfig,
  type AiBingoConfig,
  type AiBingoSelection,
  type AiBingoState,
} from "@/lib/lesson-activities/aiBingo";
import {
  AI_JUDGMENT_SORT_ACTIVITY_TYPE,
  AI_JUDGMENT_SORT_REASON_MAX_LENGTH,
  buildInitialAiJudgmentSortState,
  buildLesson2AiJudgmentSortConfig,
  isAiJudgmentSortConfig,
  normalizeJudgmentSortReason,
  normalizeJudgmentSortState,
  summarizeJudgmentSortForTeacher,
  validateJudgmentCardPlacement,
  type AiJudgmentSortConfig,
  type AiJudgmentSortState,
} from "@/lib/lesson-activities/aiJudgmentSort";
import { getLessonTemplate, type LessonTemplate } from "@/lib/lesson-activities/registry";
import {
  PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
  buildInitialPythonStudioLiteState,
  buildLesson1PythonStudioLiteConfig,
  buildLesson2PythonStudioLiteConfig,
  buildSavedPythonStudioLiteState,
  isPythonStudioLiteCompleted,
  isPythonStudioLiteConfig,
  markPythonStudioLiteSubmitted,
  normalizePythonStudioLiteState,
  summarizePythonStudioLiteForTeacher,
  type PythonStudioLiteConfig,
  type PythonStudioLiteState,
} from "@/lib/lesson-activities/pythonStudioLite";
import {
  WEB_CODING_LITE_ACTIVITY_TYPE,
  buildInitialWebCodingLiteState,
  buildLesson2WebCodingLiteConfig,
  buildSavedWebCodingLiteState,
  isWebCodingLiteCompleted,
  isWebCodingLiteConfig,
  markWebCodingLiteSubmitted,
  normalizeWebCodingLiteState,
  summarizeWebCodingLiteForTeacher,
  withWebCodingLiteHintSettings,
  type WebCodingLiteConfig,
  type WebCodingLiteState,
} from "@/lib/lesson-activities/webCodingLite";
import { canEditBoard, normalizeBoardRole } from "@/lib/auth/boardRoles";
import { createCard } from "@/lib/data/cards";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AiBingoTeacherSummary, AiJudgmentSortTeacherSummary, PythonStudioLiteTeacherSummary, WebCodingLiteSubmissionReviewPayload, WebCodingLiteTeacherSummary } from "@/lib/lesson-activities/types";

export type LessonActivityRunRow = {
  id: string;
  board_id: string;
  class_session_id: string;
  lesson_template_id: string;
  activity_type: string;
  status: "active" | "ended";
  config: unknown;
  created_by: string | null;
  created_at: string;
  started_at: string;
  ended_at: string | null;
};

export type StudentActivityStateRow = {
  id: string;
  activity_run_id: string;
  board_id: string;
  participant_key_hash: string;
  user_id: string | null;
  display_name: string | null;
  state: unknown;
  status: "in_progress" | "completed";
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

export type AiBingoStudentPayload = {
  activityRun: {
    id: string;
    activityType: typeof AI_BINGO_ACTIVITY_TYPE;
    status: "active" | "ended";
    config: AiBingoConfig;
  };
  state: AiBingoState;
  status: "in_progress" | "completed";
};

export type AiJudgmentSortStudentPayload = {
  activityRun: {
    id: string;
    activityType: typeof AI_JUDGMENT_SORT_ACTIVITY_TYPE;
    status: "active" | "ended";
    config: AiJudgmentSortConfig;
  };
  state: AiJudgmentSortState;
  status: "in_progress" | "completed";
};

export type WebCodingLiteStudentPayload = {
  activityRun: {
    id: string;
    activityType: typeof WEB_CODING_LITE_ACTIVITY_TYPE;
    status: "active" | "ended";
    config: WebCodingLiteConfig;
  };
  state: WebCodingLiteState;
  status: "in_progress" | "completed";
};

export type PythonStudioLiteStudentPayload = {
  activityRun: {
    id: string;
    activityType: typeof PYTHON_STUDIO_LITE_ACTIVITY_TYPE;
    status: "active" | "ended";
    config: PythonStudioLiteConfig;
  };
  state: PythonStudioLiteState;
  status: "in_progress" | "completed";
};

const PARTICIPANT_KEY_MIN_LENGTH = 12;
const PARTICIPANT_KEY_MAX_LENGTH = 96;

function hashParticipantKey(participantKey: string): string {
  return createHash("sha256").update(participantKey).digest("hex");
}

export function validateParticipantKey(participantKey: string): string {
  const trimmed = participantKey.trim();
  if (
    trimmed.length < PARTICIPANT_KEY_MIN_LENGTH ||
    trimmed.length > PARTICIPANT_KEY_MAX_LENGTH
  ) {
    throw new Error("참여자 키가 올바르지 않습니다.");
  }
  if (!/^[A-Za-z0-9:_-]+$/.test(trimmed)) {
    throw new Error("참여자 키가 올바르지 않습니다.");
  }
  return trimmed;
}

function coerceAiBingoState(
  value: unknown,
  fallback: AiBingoState,
): AiBingoState {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fallback;
  const candidate = value as Partial<AiBingoState>;
  if (
    !Array.isArray(candidate.tileIds) ||
    typeof candidate.selections !== "object" ||
    candidate.selections === null
  )
    return fallback;
  const selectedEntries = Object.entries(candidate.selections).filter(
    (entry): entry is [string, AiBingoSelection] => {
      const selection = entry[1] as Partial<AiBingoSelection>;
      return (
        typeof selection.tileId === "string" &&
        typeof selection.reason === "string" &&
        typeof selection.selectedAt === "string"
      );
    },
  );
  const selections = Object.fromEntries(selectedEntries);
  const bingoLines = calculateAiBingoLines(
    candidate.tileIds,
    Object.keys(selections),
    candidate.boardSize ?? fallback.boardSize,
  );
  return {
    version: fallback.version,
    boardSize: fallback.boardSize,
    tileIds: candidate.tileIds
      .filter((tileId): tileId is string => typeof tileId === "string")
      .slice(0, fallback.boardSize * fallback.boardSize),
    selections,
    bingoLines,
    completed: bingoLines.length > 0,
  };
}

export async function ensureLessonActivityRun(params: {
  boardId: string;
  classSessionId: string;
  lessonTemplateId: LessonTemplate["id"];
  createdBy: string;
}): Promise<LessonActivityRunRow[]> {
  const template = getLessonTemplate(params.lessonTemplateId);
  if (!template) return [];

  const runSpecs: Array<{
    activityType: string;
    config: AiBingoConfig | AiJudgmentSortConfig | WebCodingLiteConfig | PythonStudioLiteConfig;
  }> = [];

  for (const activity of template.activities) {
    if (activity.activityType === AI_BINGO_ACTIVITY_TYPE) {
      runSpecs.push({ activityType: AI_BINGO_ACTIVITY_TYPE, config: buildLesson1AiBingoConfig() });
    } else if (activity.activityType === AI_JUDGMENT_SORT_ACTIVITY_TYPE) {
      runSpecs.push({ activityType: AI_JUDGMENT_SORT_ACTIVITY_TYPE, config: buildLesson2AiJudgmentSortConfig() });
    } else if (activity.activityType === WEB_CODING_LITE_ACTIVITY_TYPE) {
      runSpecs.push({ activityType: WEB_CODING_LITE_ACTIVITY_TYPE, config: buildLesson2WebCodingLiteConfig() });
    } else if (activity.activityType === PYTHON_STUDIO_LITE_ACTIVITY_TYPE) {
      const config = params.lessonTemplateId === "lesson_02_ai_judgment_if_else"
        ? buildLesson2PythonStudioLiteConfig()
        : buildLesson1PythonStudioLiteConfig();
      runSpecs.push({ activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE, config });
    }
  }
  if (runSpecs.length === 0) return [];

  const supabase = createSupabaseAdminClient();
  const rows: LessonActivityRunRow[] = [];

  for (const spec of runSpecs) {
    const { data: existing, error: existingError } = await supabase
      .from("lesson_activity_runs")
      .select(
        "id, board_id, class_session_id, lesson_template_id, activity_type, status, config, created_by, created_at, started_at, ended_at",
      )
      .eq("board_id", params.boardId)
      .eq("class_session_id", params.classSessionId)
      .eq("activity_type", spec.activityType)
      .maybeSingle<LessonActivityRunRow>();

    if (existingError) throw new Error(existingError.message);
    if (existing) {
      rows.push(existing);
      continue;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("lesson_activity_runs")
      .insert({
        board_id: params.boardId,
        class_session_id: params.classSessionId,
        lesson_template_id: params.lessonTemplateId,
        activity_type: spec.activityType,
        status: "active",
        config: spec.config,
        created_by: params.createdBy,
      })
      .select(
        "id, board_id, class_session_id, lesson_template_id, activity_type, status, config, created_by, created_at, started_at, ended_at",
      )
      .single<LessonActivityRunRow>();

    if (insertError) throw new Error(insertError.message);
    if (!inserted) throw new Error("수업 활동을 만들지 못했습니다.");
    rows.push(inserted);
  }

  return rows;
}

export async function endActivityRunsForSession(params: {
  boardId: string;
  classSessionId: string;
}): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const endedAt = new Date().toISOString();
  const { error } = await supabase
    .from("lesson_activity_runs")
    .update({ status: "ended", ended_at: endedAt })
    .eq("board_id", params.boardId)
    .eq("class_session_id", params.classSessionId)
    .eq("status", "active");
  if (error) throw new Error(error.message);
}

async function assertCanReviewWebCodingLiteSubmissions(boardId: string, actor: { userId: string }): Promise<void> {
  if (!actor.userId) {
    throw new Error("로그인이 필요합니다.");
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("board_role", { bid: boardId });
  if (error) {
    throw new Error(error.message);
  }
  const role = normalizeBoardRole(data);
  if (!canEditBoard(role)) {
    throw new Error("웹 코딩 제출물을 볼 권한이 없습니다.");
  }
}

async function assertCanManageWebCodingLiteSettings(boardId: string, actor: { userId: string }): Promise<void> {
  if (!actor.userId) {
    throw new Error("로그인이 필요합니다.");
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("board_role", { bid: boardId });
  if (error) {
    throw new Error(error.message);
  }
  const role = normalizeBoardRole(data);
  if (!canEditBoard(role)) {
    throw new Error("웹 스튜디오 힌트 설정을 바꿀 권한이 없습니다.");
  }
}

function countCode(value: string): { chars: number; lines: number } {
  return {
    chars: value.length,
    lines: value.length === 0 ? 0 : value.split(/\r\n|\r|\n/).length,
  };
}

function buildCodeCounts(html: string, css: string, js: string) {
  const htmlCounts = countCode(html);
  const cssCounts = countCode(css);
  const jsCounts = countCode(js);
  return {
    html: htmlCounts,
    css: cssCounts,
    js: jsCounts,
    totalChars: htmlCounts.chars + cssCounts.chars + jsCounts.chars,
    totalLines: htmlCounts.lines + cssCounts.lines + jsCounts.lines,
  };
}

async function getActiveActivityRunForBoard(
  boardId: string,
  activityType: string,
): Promise<LessonActivityRunRow | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lesson_activity_runs")
    .select(
      "id, board_id, class_session_id, lesson_template_id, activity_type, status, config, created_by, created_at, started_at, ended_at",
    )
    .eq("board_id", boardId)
    .eq("activity_type", activityType)
    .eq("status", "active")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle<LessonActivityRunRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}


async function getLatestActivityRunForBoard(
  boardId: string,
  activityType: string,
): Promise<LessonActivityRunRow | null> {
  const active = await getActiveActivityRunForBoard(boardId, activityType);
  if (active) return active;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lesson_activity_runs")
    .select(
      "id, board_id, class_session_id, lesson_template_id, activity_type, status, config, created_by, created_at, started_at, ended_at",
    )
    .eq("board_id", boardId)
    .eq("activity_type", activityType)
    .order("started_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<LessonActivityRunRow>();
  if (error) throw new Error(error.message);
  return data ?? null;
}

export async function getOrCreateAiBingoStateForParticipant(params: {
  boardId: string;
  participantKey: string;
  displayName?: string | null;
  userId?: string | null;
}): Promise<AiBingoStudentPayload | null> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, AI_BINGO_ACTIVITY_TYPE);
  if (!activityRun) return null;
  if (!isAiBingoConfig(activityRun.config))
    throw new Error("AI 빙고 설정이 올바르지 않습니다.");

  const participantKeyHash = hashParticipantKey(participantKey);
  const fallbackState = buildInitialAiBingoState(
    activityRun.config,
    activityRun.id,
    participantKey,
  );
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("student_activity_states")
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .maybeSingle<StudentActivityStateRow>();

  if (existingError) throw new Error(existingError.message);

  const row =
    existing ??
    (await insertInitialState({
      activityRunId: activityRun.id,
      boardId: params.boardId,
      participantKeyHash,
      displayName: params.displayName ?? "익명 학생",
      userId: params.userId ?? null,
      state: fallbackState,
    }));

  const state = coerceAiBingoState(row.state, fallbackState);
  return {
    activityRun: {
      id: activityRun.id,
      activityType: AI_BINGO_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state,
    status: row.status,
  };
}

async function insertInitialState(params: {
  activityRunId: string;
  boardId: string;
  participantKeyHash: string;
  displayName: string;
  userId: string | null;
  state: AiBingoState | AiJudgmentSortState | WebCodingLiteState | PythonStudioLiteState;
}): Promise<StudentActivityStateRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .upsert(
      {
        activity_run_id: params.activityRunId,
        board_id: params.boardId,
        participant_key_hash: params.participantKeyHash,
        user_id: params.userId,
        display_name: params.displayName,
        state: params.state,
        status: "in_progress",
      },
      {
        onConflict: "activity_run_id,participant_key_hash",
        ignoreDuplicates: false,
      },
    )
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .single<StudentActivityStateRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("학생 활동 상태를 만들지 못했습니다.");
  if (data.board_id !== params.boardId)
    throw new Error("학생 활동 상태의 보드가 올바르지 않습니다.");
  return data;
}

export async function getOrCreateAiJudgmentSortStateForParticipant(params: {
  boardId: string;
  participantKey: string;
  displayName?: string | null;
  userId?: string | null;
}): Promise<AiJudgmentSortStudentPayload | null> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, AI_JUDGMENT_SORT_ACTIVITY_TYPE);
  if (!activityRun) return null;
  if (!isAiJudgmentSortConfig(activityRun.config))
    throw new Error("AI 판단 카드 분류 설정이 올바르지 않습니다.");

  const participantKeyHash = hashParticipantKey(participantKey);
  const fallbackState = buildInitialAiJudgmentSortState(activityRun.id, participantKey);
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("student_activity_states")
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .maybeSingle<StudentActivityStateRow>();

  if (existingError) throw new Error(existingError.message);

  const row =
    existing ??
    (await insertInitialState({
      activityRunId: activityRun.id,
      boardId: params.boardId,
      participantKeyHash,
      displayName: params.displayName ?? "익명 학생",
      userId: params.userId ?? null,
      state: fallbackState,
    }));

  const state = normalizeJudgmentSortState(row.state, fallbackState);
  return {
    activityRun: {
      id: activityRun.id,
      activityType: AI_JUDGMENT_SORT_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state,
    status: row.status,
  };
}

export async function updateAiJudgmentSortState(params: {
  boardId: string;
  activityRunId: string;
  participantKey: string;
  operation: "place_card" | "save_reason" | "submit";
  cardId?: string;
  category?: unknown;
  reason?: unknown;
  displayName?: string | null;
  userId?: string | null;
}): Promise<AiJudgmentSortStudentPayload> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, AI_JUDGMENT_SORT_ACTIVITY_TYPE);
  if (!activityRun || activityRun.id !== params.activityRunId)
    throw new Error("활동 정보를 확인할 수 없습니다.");
  if (!isAiJudgmentSortConfig(activityRun.config))
    throw new Error("AI 판단 카드 분류 설정이 올바르지 않습니다.");

  const current = await getOrCreateAiJudgmentSortStateForParticipant({
    boardId: params.boardId,
    participantKey,
    displayName: params.displayName,
    userId: params.userId,
  });
  if (!current) throw new Error("활동 상태를 불러오지 못했습니다.");

  const now = new Date().toISOString();
  const cards = current.state.cards.map((card) => ({ ...card }));

  if (params.operation === "place_card") {
    const cardId = params.cardId ?? "";
    const category = validateJudgmentCardPlacement(activityRun.config, cardId, params.category);
    const card = cards.find((item) => item.cardId === cardId);
    if (!card) throw new Error("내 활동 카드에 없는 항목입니다.");
    card.category = category;
  } else if (params.operation === "save_reason") {
    const cardId = params.cardId ?? "";
    if (!activityRun.config.cards.some((card) => card.id === cardId)) throw new Error("활동 카드에 없는 항목입니다.");
    const reason = normalizeJudgmentSortReason(params.reason);
    if (reason.length > AI_JUDGMENT_SORT_REASON_MAX_LENGTH)
      throw new Error(`이유는 ${AI_JUDGMENT_SORT_REASON_MAX_LENGTH}자 이내로 적어주세요.`);
    const card = cards.find((item) => item.cardId === cardId);
    if (!card) throw new Error("내 활동 카드에 없는 항목입니다.");
    card.reason = reason;
  } else if (params.operation === "submit") {
    if (!cards.every((card) => Boolean(card.category)))
      throw new Error("모든 카드를 먼저 분류해 주세요.");
  } else {
    throw new Error("지원하지 않는 저장 요청입니다.");
  }

  const submitted = params.operation === "submit" ? true : current.state.submitted;
  const nextState = normalizeJudgmentSortState(
    {
      ...current.state,
      cards,
      submitted,
      updatedAt: now,
    },
    buildInitialAiJudgmentSortState(activityRun.id, participantKey),
  );
  const nextStatus = nextState.completed ? "completed" : "in_progress";
  const participantKeyHash = hashParticipantKey(participantKey);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .update({
      state: nextState,
      status: nextStatus,
      display_name: params.displayName ?? "익명 학생",
      user_id: params.userId ?? null,
      updated_at: now,
      submitted_at: nextState.completed ? now : null,
    })
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .single<StudentActivityStateRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("학생 활동 상태를 저장하지 못했습니다.");

  return {
    activityRun: {
      id: activityRun.id,
      activityType: AI_JUDGMENT_SORT_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state: normalizeJudgmentSortState(data.state, nextState),
    status: data.status,
  };
}

export async function getOrCreateWebCodingLiteStateForParticipant(params: {
  boardId: string;
  participantKey: string;
  displayName?: string | null;
  userId?: string | null;
}): Promise<WebCodingLiteStudentPayload | null> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, WEB_CODING_LITE_ACTIVITY_TYPE);
  if (!activityRun) return null;
  if (!isWebCodingLiteConfig(activityRun.config))
    throw new Error("웹 코딩 실습 설정이 올바르지 않습니다.");

  const participantKeyHash = hashParticipantKey(participantKey);
  const fallbackState = buildInitialWebCodingLiteState(activityRun.config);
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("student_activity_states")
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .maybeSingle<StudentActivityStateRow>();

  if (existingError) throw new Error(existingError.message);

  const row =
    existing ??
    (await insertInitialState({
      activityRunId: activityRun.id,
      boardId: params.boardId,
      participantKeyHash,
      displayName: params.displayName ?? "익명 학생",
      userId: params.userId ?? null,
      state: fallbackState,
    }));

  const state = normalizeWebCodingLiteState(row.state, fallbackState);
  return {
    activityRun: {
      id: activityRun.id,
      activityType: WEB_CODING_LITE_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state,
    status: row.status,
  };
}


export async function getOrCreatePythonStudioLiteStateForParticipant(params: {
  boardId: string;
  participantKey: string;
  displayName?: string | null;
  userId?: string | null;
}): Promise<PythonStudioLiteStudentPayload | null> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, PYTHON_STUDIO_LITE_ACTIVITY_TYPE);
  if (!activityRun) return null;
  if (!isPythonStudioLiteConfig(activityRun.config))
    throw new Error("파이썬 실습 설정이 올바르지 않습니다.");

  const participantKeyHash = hashParticipantKey(participantKey);
  const fallbackState = buildInitialPythonStudioLiteState(activityRun.config);
  const supabase = createSupabaseAdminClient();

  const { data: existing, error: existingError } = await supabase
    .from("student_activity_states")
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .maybeSingle<StudentActivityStateRow>();

  if (existingError) throw new Error(existingError.message);

  const row =
    existing ??
    (await insertInitialState({
      activityRunId: activityRun.id,
      boardId: params.boardId,
      participantKeyHash,
      displayName: params.displayName ?? "익명 학생",
      userId: params.userId ?? null,
      state: fallbackState,
    }));

  const state = normalizePythonStudioLiteState(row.state, fallbackState);
  return {
    activityRun: {
      id: activityRun.id,
      activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state,
    status: row.status,
  };
}

export async function updateWebCodingLiteState(params: {
  boardId: string;
  activityRunId: string;
  participantKey: string;
  operation: "save_code" | "submit" | "reset_to_starter";
  html?: unknown;
  css?: unknown;
  js?: unknown;
  displayName?: string | null;
  userId?: string | null;
}): Promise<WebCodingLiteStudentPayload> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, WEB_CODING_LITE_ACTIVITY_TYPE);
  if (!activityRun || activityRun.id !== params.activityRunId)
    throw new Error("활동 정보를 확인할 수 없습니다.");
  if (!isWebCodingLiteConfig(activityRun.config))
    throw new Error("웹 코딩 실습 설정이 올바르지 않습니다.");

  const current = await getOrCreateWebCodingLiteStateForParticipant({
    boardId: params.boardId,
    participantKey,
    displayName: params.displayName,
    userId: params.userId,
  });
  if (!current) throw new Error("활동 상태를 불러오지 못했습니다.");

  const now = new Date().toISOString();
  let nextState: WebCodingLiteState;
  if (params.operation === "save_code") {
    nextState = buildSavedWebCodingLiteState(current.state, { html: params.html, css: params.css, js: params.js }, now);
  } else if (params.operation === "submit") {
    const saved = buildSavedWebCodingLiteState(current.state, { html: params.html ?? current.state.html, css: params.css ?? current.state.css, js: params.js ?? current.state.js }, now);
    nextState = markWebCodingLiteSubmitted(saved, now);
  } else if (params.operation === "reset_to_starter") {
    nextState = { ...buildInitialWebCodingLiteState(activityRun.config), savedAt: now };
  } else {
    throw new Error("지원하지 않는 저장 요청입니다.");
  }

  const nextStatus = isWebCodingLiteCompleted(nextState) ? "completed" : "in_progress";
  const participantKeyHash = hashParticipantKey(participantKey);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .update({
      state: nextState,
      status: nextStatus,
      display_name: params.displayName ?? "익명 학생",
      user_id: params.userId ?? null,
      updated_at: now,
      submitted_at: nextState.submittedAt,
    })
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .single<StudentActivityStateRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("학생 활동 상태를 저장하지 못했습니다.");

  return {
    activityRun: {
      id: activityRun.id,
      activityType: WEB_CODING_LITE_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state: normalizeWebCodingLiteState(data.state, nextState),
    status: data.status,
  };
}


export async function updatePythonStudioLiteState(params: {
  boardId: string;
  activityRunId: string;
  participantKey: string;
  operation: "save_code" | "submit" | "reset_to_starter";
  code?: unknown;
  stdin?: unknown;
  stdout?: unknown;
  stderr?: unknown;
  displayName?: string | null;
  userId?: string | null;
}): Promise<PythonStudioLiteStudentPayload> {
  const participantKey = validateParticipantKey(params.participantKey);
  const activityRun = await getActiveActivityRunForBoard(params.boardId, PYTHON_STUDIO_LITE_ACTIVITY_TYPE);
  if (!activityRun || activityRun.id !== params.activityRunId)
    throw new Error("활동 정보를 확인할 수 없습니다.");
  if (!isPythonStudioLiteConfig(activityRun.config))
    throw new Error("파이썬 실습 설정이 올바르지 않습니다.");

  const current = await getOrCreatePythonStudioLiteStateForParticipant({
    boardId: params.boardId,
    participantKey,
    displayName: params.displayName,
    userId: params.userId,
  });
  if (!current) throw new Error("활동 상태를 불러오지 못했습니다.");

  const now = new Date().toISOString();
  let nextState: PythonStudioLiteState;
  if (params.operation === "save_code") {
    nextState = buildSavedPythonStudioLiteState(current.state, { code: params.code, stdin: params.stdin, stdout: params.stdout, stderr: params.stderr }, now);
  } else if (params.operation === "submit") {
    const saved = buildSavedPythonStudioLiteState(current.state, {
      code: params.code ?? current.state.code,
      stdin: params.stdin ?? current.state.stdin,
      stdout: params.stdout ?? current.state.stdout,
      stderr: params.stderr ?? current.state.stderr,
    }, now);
    nextState = markPythonStudioLiteSubmitted(saved, now);
  } else if (params.operation === "reset_to_starter") {
    nextState = { ...buildInitialPythonStudioLiteState(activityRun.config), savedAt: now };
  } else {
    throw new Error("지원하지 않는 저장 요청입니다.");
  }

  const nextStatus = isPythonStudioLiteCompleted(nextState) ? "completed" : "in_progress";
  const participantKeyHash = hashParticipantKey(participantKey);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .update({
      state: nextState,
      status: nextStatus,
      display_name: params.displayName ?? "익명 학생",
      user_id: params.userId ?? null,
      updated_at: now,
      submitted_at: nextState.submittedAt,
    })
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .single<StudentActivityStateRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("학생 활동 상태를 저장하지 못했습니다.");

  return {
    activityRun: {
      id: activityRun.id,
      activityType: PYTHON_STUDIO_LITE_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state: normalizePythonStudioLiteState(data.state, nextState),
    status: data.status,
  };
}

export async function upsertAiBingoSelection(params: {
  boardId: string;
  activityRunId: string;
  participantKey: string;
  tileId: string;
  reason: string;
  displayName?: string | null;
  userId?: string | null;
}): Promise<AiBingoStudentPayload> {
  const participantKey = validateParticipantKey(params.participantKey);
  const reason = normalizeAiBingoReason(params.reason);
  if (!reason) throw new Error("이유를 한 줄로 적어주세요.");
  if (reason.length > AI_BINGO_REASON_MAX_LENGTH)
    throw new Error(
      `이유는 ${AI_BINGO_REASON_MAX_LENGTH}자 이내로 적어주세요.`,
    );

  const activityRun = await getActiveActivityRunForBoard(params.boardId, AI_BINGO_ACTIVITY_TYPE);
  if (!activityRun || activityRun.id !== params.activityRunId)
    throw new Error("활동 정보를 확인할 수 없습니다.");
  if (!isAiBingoConfig(activityRun.config))
    throw new Error("AI 빙고 설정이 올바르지 않습니다.");
  if (!tileExistsInAiBingoConfig(activityRun.config, params.tileId))
    throw new Error("빙고판에 없는 타일입니다.");

  const current = await getOrCreateAiBingoStateForParticipant({
    boardId: params.boardId,
    participantKey,
    displayName: params.displayName,
    userId: params.userId,
  });
  if (!current) throw new Error("활동 상태를 불러오지 못했습니다.");
  if (!current.state.tileIds.includes(params.tileId))
    throw new Error("내 빙고판에 없는 타일입니다.");

  const now = new Date().toISOString();
  const selections = {
    ...current.state.selections,
    [params.tileId]: { tileId: params.tileId, reason, selectedAt: now },
  };
  const bingoLines = calculateAiBingoLines(
    current.state.tileIds,
    Object.keys(selections),
    current.state.boardSize,
  );
  const nextState: AiBingoState = {
    ...current.state,
    selections,
    bingoLines,
    completed: bingoLines.length > 0,
  };
  const nextStatus = nextState.completed ? "completed" : "in_progress";
  const participantKeyHash = hashParticipantKey(participantKey);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .update({
      state: nextState,
      status: nextStatus,
      display_name: params.displayName ?? "익명 학생",
      user_id: params.userId ?? null,
      updated_at: now,
      submitted_at: nextState.completed ? now : null,
    })
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("participant_key_hash", participantKeyHash)
    .select(
      "id, activity_run_id, board_id, participant_key_hash, user_id, display_name, state, status, created_at, updated_at, submitted_at",
    )
    .single<StudentActivityStateRow>();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("학생 활동 상태를 저장하지 못했습니다.");

  return {
    activityRun: {
      id: activityRun.id,
      activityType: AI_BINGO_ACTIVITY_TYPE,
      status: activityRun.status,
      config: activityRun.config,
    },
    state: coerceAiBingoState(data.state, nextState),
    status: data.status,
  };
}

export async function getAiBingoTeacherSummaryForBoard(
  boardId: string,
): Promise<AiBingoTeacherSummary | null> {
  const activityRun = await getActiveActivityRunForBoard(boardId, AI_BINGO_ACTIVITY_TYPE);
  if (!activityRun || !isAiBingoConfig(activityRun.config)) return null;

  const tileLabels = new Map(
    activityRun.config.tilePool.map((tile) => [tile.id, tile.label]),
  );
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .select("id, display_name, state, status, updated_at")
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<
    Pick<
      StudentActivityStateRow,
      "id" | "display_name" | "state" | "status" | "updated_at"
    >
  >;
  let selectedTileCount = 0;
  const recentReasons: AiBingoTeacherSummary["recentReasons"] = [];
  rows.forEach((row) => {
    const state = coerceAiBingoState(
      row.state,
      buildInitialAiBingoState(
        activityRun.config as AiBingoConfig,
        activityRun.id,
        row.id,
      ),
    );
    const selections = Object.values(state.selections);
    selectedTileCount += selections.length;
    selections
      .slice(-3)
      .reverse()
      .forEach((selection) => {
        recentReasons.push({
          id: `${row.id}:${selection.tileId}`,
          displayName: row.display_name || "익명 학생",
          tileLabel: tileLabels.get(selection.tileId) ?? selection.tileId,
          reason: selection.reason,
          updatedAt: row.updated_at,
        });
      });
  });

  recentReasons.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return {
    activityRunId: activityRun.id,
    activityTitle: "AI 빙고 아레나",
    participantCount: rows.length,
    completedCount: rows.filter((row) => row.status === "completed").length,
    selectedTileCount,
    recentReasons: recentReasons.slice(0, 6),
  };
}


export async function getAiJudgmentSortTeacherSummaryForBoard(
  boardId: string,
): Promise<AiJudgmentSortTeacherSummary | null> {
  const activityRun = await getActiveActivityRunForBoard(boardId, AI_JUDGMENT_SORT_ACTIVITY_TYPE);
  if (!activityRun || !isAiJudgmentSortConfig(activityRun.config)) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .select("id, display_name, state, status, updated_at")
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<
    Pick<StudentActivityStateRow, "id" | "display_name" | "state" | "status" | "updated_at">
  >;

  return summarizeJudgmentSortForTeacher({
    activityRunId: activityRun.id,
    config: activityRun.config,
    rows: rows.map((row) => ({
      id: row.id,
      displayName: row.display_name,
      state: row.state,
      status: row.status,
      updatedAt: row.updated_at,
    })),
  });
}


export async function updateWebCodingLiteHintSettingsForBoard(params: {
  boardId: string;
  actor: { userId: string };
  hintsEnabled: boolean;
}): Promise<{ activityRunId: string; hintsEnabled: boolean }> {
  await assertCanManageWebCodingLiteSettings(params.boardId, params.actor);

  const activityRun = await getActiveActivityRunForBoard(params.boardId, WEB_CODING_LITE_ACTIVITY_TYPE);
  if (!activityRun || !isWebCodingLiteConfig(activityRun.config)) {
    throw new Error("진행 중인 웹 코딩 실습이 없습니다.");
  }

  const nextConfig = withWebCodingLiteHintSettings(activityRun.config, params.hintsEnabled);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("lesson_activity_runs")
    .update({ config: nextConfig })
    .eq("id", activityRun.id)
    .eq("board_id", params.boardId)
    .eq("activity_type", WEB_CODING_LITE_ACTIVITY_TYPE)
    .eq("status", "active")
    .select("id, config")
    .single<{ id: string; config: unknown }>();

  if (error) throw new Error(error.message);
  if (!data || !isWebCodingLiteConfig(data.config)) {
    throw new Error("웹 스튜디오 힌트 설정을 저장하지 못했습니다.");
  }

  return { activityRunId: data.id, hintsEnabled: data.config.hintsEnabled };
}


export async function getPythonStudioLiteTeacherSummaryForBoard(
  boardId: string,
): Promise<PythonStudioLiteTeacherSummary | null> {
  const activityRun = await getActiveActivityRunForBoard(boardId, PYTHON_STUDIO_LITE_ACTIVITY_TYPE);
  if (!activityRun || !isPythonStudioLiteConfig(activityRun.config)) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .select("id, display_name, state, status, updated_at, submitted_at")
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);

  return summarizePythonStudioLiteForTeacher({
    activityRunId: activityRun.id,
    config: activityRun.config,
    rows: ((data ?? []) as Array<
      Pick<StudentActivityStateRow, "id" | "display_name" | "state" | "status" | "updated_at" | "submitted_at">
    >).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      state: row.state,
      status: row.status,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
    })),
  });
}


export async function getWebCodingLiteTeacherSummaryForBoard(
  boardId: string,
): Promise<WebCodingLiteTeacherSummary | null> {
  const activityRun = await getActiveActivityRunForBoard(boardId, WEB_CODING_LITE_ACTIVITY_TYPE);
  if (!activityRun || !isWebCodingLiteConfig(activityRun.config)) return null;

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .select("id, display_name, state, status, updated_at, submitted_at")
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", boardId)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message);

  return summarizeWebCodingLiteForTeacher({
    activityRunId: activityRun.id,
    config: activityRun.config,
    rows: ((data ?? []) as Array<
      Pick<StudentActivityStateRow, "id" | "display_name" | "state" | "status" | "updated_at" | "submitted_at">
    >).map((row) => ({
      id: row.id,
      displayName: row.display_name,
      state: row.state,
      status: row.status,
      updatedAt: row.updated_at,
      submittedAt: row.submitted_at,
    })),
  });
}


export async function getWebCodingLiteSubmissionsForBoard(
  boardId: string,
  actor: { userId: string },
  options: { limit?: number } = {},
): Promise<WebCodingLiteSubmissionReviewPayload> {
  await assertCanReviewWebCodingLiteSubmissions(boardId, actor);

  const activityRun = await getLatestActivityRunForBoard(boardId, WEB_CODING_LITE_ACTIVITY_TYPE);
  if (!activityRun || !isWebCodingLiteConfig(activityRun.config)) {
    throw new Error("진행된 웹 코딩 실습이 없습니다.");
  }

  const limit = Math.min(Math.max(options.limit ?? 80, 1), 120);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("student_activity_states")
    .select("id, state, status, updated_at, submitted_at")
    .eq("activity_run_id", activityRun.id)
    .eq("board_id", boardId)
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const fallback = buildInitialWebCodingLiteState(activityRun.config);
  const submissions = ((data ?? []) as Array<
    Pick<StudentActivityStateRow, "id" | "state" | "status" | "updated_at" | "submitted_at">
  >)
    .map((row) => {
      const state = normalizeWebCodingLiteState(row.state, fallback);
      return { row, state };
    })
    .filter(({ state }) => Boolean(state.savedAt || state.submittedAt || state.submitted))
    .sort((a, b) => {
      if (a.state.submitted !== b.state.submitted) return a.state.submitted ? -1 : 1;
      const aTime = a.state.submittedAt ?? a.state.savedAt ?? a.row.updated_at;
      const bTime = b.state.submittedAt ?? b.state.savedAt ?? b.row.updated_at;
      return bTime.localeCompare(aTime);
    })
    .map(({ row, state }, index) => ({
      id: row.id,
      studentLabel: `익명 학생 ${index + 1}`,
      savedAt: state.savedAt ?? row.updated_at ?? null,
      submitted: state.submitted,
      submittedAt: state.submittedAt ?? row.submitted_at,
      html: state.html,
      css: state.css,
      js: state.js,
      counts: buildCodeCounts(state.html, state.css, state.js),
    }));

  return {
    activityRunId: activityRun.id,
    activityTitle: "웹 코딩 실습실",
    submissions,
  };
}


export type WebCodingLiteSubmissionCardResult = {
  cardId: string;
  wallId: string;
  studentLabel: string;
  cardText: string;
};

export function buildWebCodingLiteSubmissionCardText(input: {
  studentLabel: string;
  submitted: boolean;
  submittedAt: string | null;
  savedAt: string | null;
}): string {
  const status = input.submitted ? "제출됨" : "저장됨";
  const time = input.submittedAt ?? input.savedAt ?? "기록 없음";
  return [
    `웹 코딩 제출물: ${input.studentLabel}`,
    "",
    "활동: 웹 코딩 실습실",
    `상태: ${status}`,
    `제출/저장 시간: ${time}`,
    "",
    "교사 제출 갤러리에서 미리보기와 코드를 확인할 수 있어요.",
    "학생 작품 발표용",
  ].join("\n");
}

export async function createWebCodingLiteSubmissionBoardCard(params: {
  boardId: string;
  stateId: string;
  actor: { userId: string };
}): Promise<WebCodingLiteSubmissionCardResult> {
  const payload = await getWebCodingLiteSubmissionsForBoard(params.boardId, params.actor, { limit: 120 });
  const submission = payload.submissions.find((item) => item.id === params.stateId);
  if (!submission) {
    throw new Error("웹 코딩 제출물이 이 보드에 속하지 않습니다.");
  }

  const supabase = createSupabaseServerClient();
  const { data: wall, error: wallError } = await supabase
    .from("walls")
    .select("id")
    .eq("board_id", params.boardId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (wallError) throw new Error(wallError.message);
  if (!wall?.id) throw new Error("보드에 카드를 만들 담벼락이 없습니다.");

  const cardText = buildWebCodingLiteSubmissionCardText({
    studentLabel: submission.studentLabel,
    submitted: submission.submitted,
    submittedAt: submission.submittedAt,
    savedAt: submission.savedAt,
  });

  const card = await createCard({
    wallId: wall.id,
    boardId: params.boardId,
    text: cardText,
    authorType: "teacher",
    authorName: "교사",
  });

  return {
    cardId: card.id,
    wallId: wall.id,
    studentLabel: submission.studentLabel,
    cardText,
  };
}
