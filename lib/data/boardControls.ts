import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getBoardByShareCode } from "@/lib/data/share";
import { CUSTOM_TEMPLATE_IDS, DEFAULT_HUD, DEFAULT_LOCKS, DEFAULT_REPLY_TEMPLATES } from "@/lib/controls/boardControlsDefaults";
import type {
  BoardControlHud,
  BoardControlLocks,
  BoardControls,
  BoardControlsPublic,
  BoardReplyTemplate,
} from "@/lib/types/boardControls";

const DEFAULT_CONTROLS: Omit<BoardControls, "boardId" | "updatedAt"> = {
  announcement: null,
  locks: DEFAULT_LOCKS,
  hud: DEFAULT_HUD,
  replyTemplates: DEFAULT_REPLY_TEMPLATES,
  pinnedQuestionIds: [],
  hiddenActionIds: [],
  resolvedHelpIds: [],
  version: 1,
};

type BoardControlsRow = {
  board_id: string;
  updated_at: string;
  updated_by_user_id?: string | null;
  announcement: string | null;
  inputs_locked: boolean;
  locks?: Record<string, unknown> | null;
  hud?: Record<string, unknown> | null;
  reply_templates?: Record<string, unknown>[] | null;
  pinned_question_ids: string[];
  hidden_action_ids: string[];
  resolved_help_ids: string[];
  version: number;
};

function readBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeLocks(value: unknown, fallback: BoardControlLocks) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  return {
    question: readBoolean(record.question, fallback.question),
    help: readBoolean(record.help, fallback.help),
    pulse: readBoolean(record.pulse, fallback.pulse),
  };
}

function normalizeHud(value: unknown, fallback: BoardControlHud) {
  if (!value || typeof value !== "object") return fallback;
  const record = value as Record<string, unknown>;
  return {
    showRoster: readBoolean(record.showRoster, fallback.showRoster),
    showPulse: readBoolean(record.showPulse, fallback.showPulse),
    showPinned: readBoolean(record.showPinned, fallback.showPinned),
  };
}

function normalizeReplyTemplates(value: unknown, fallback: BoardReplyTemplate[]) {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const label = typeof record.label === "string" ? record.label.trim() : "";
      const text = typeof record.text === "string" ? record.text.trim() : "";
      if (!id || !label || !text) return null;
      return { id, label, text };
    })
    .filter((entry): entry is BoardReplyTemplate => Boolean(entry));
  if (!items.length) return fallback;
  const unique = new Map<string, BoardReplyTemplate>();
  items.forEach((entry) => unique.set(entry.id, entry));
  const normalized = Array.from(unique.values()).slice(0, 8);
  const customMap = new Map(normalized.map((entry) => [entry.id, entry]));
  const customSlots = CUSTOM_TEMPLATE_IDS.map((id) => customMap.get(id)).filter(
    (entry): entry is BoardReplyTemplate => Boolean(entry),
  );
  return [...DEFAULT_REPLY_TEMPLATES, ...customSlots];
}

function hasLockValues(locks: BoardControlLocks) {
  return Object.values(locks).some((value) => typeof value === "boolean");
}

function mapRow(row: BoardControlsRow): BoardControls {
  const fallbackLocks = row.inputs_locked ? { question: true, help: true, pulse: true } : DEFAULT_LOCKS;
  const normalizedLocks = normalizeLocks(row.locks, fallbackLocks);
  const locks = hasLockValues(normalizedLocks) ? normalizedLocks : fallbackLocks;
  return {
    boardId: row.board_id,
    updatedAt: row.updated_at,
    announcement: row.announcement ?? null,
    locks,
    hud: normalizeHud(row.hud, DEFAULT_HUD),
    replyTemplates: normalizeReplyTemplates(row.reply_templates, DEFAULT_REPLY_TEMPLATES),
    pinnedQuestionIds: row.pinned_question_ids ?? [],
    hiddenActionIds: row.hidden_action_ids ?? [],
    resolvedHelpIds: row.resolved_help_ids ?? [],
    version: row.version ?? 1,
  };
}

export function buildDefaultControls(boardId: string): BoardControls {
  return {
    boardId,
    updatedAt: new Date().toISOString(),
    ...DEFAULT_CONTROLS,
  };
}

export function buildDefaultControlsRow(boardId: string) {
  return {
    board_id: boardId,
    updated_at: new Date().toISOString(),
    announcement: null,
    inputs_locked: false,
    locks: DEFAULT_LOCKS,
    hud: DEFAULT_HUD,
    reply_templates: DEFAULT_REPLY_TEMPLATES,
    pinned_question_ids: [],
    hidden_action_ids: [],
    resolved_help_ids: [],
    version: 1,
  };
}

export function sanitizeControlsForStudent(controls: BoardControls): BoardControlsPublic {
  return {
    announcement: controls.announcement,
    updatedAt: controls.updatedAt,
    locks: controls.locks,
    hud: controls.hud,
  };
}

export async function getBoardControls(
  boardId: string,
  options?: { useServiceRole?: boolean; createIfMissing?: boolean },
): Promise<BoardControls> {
  const supabase = options?.useServiceRole ? createSupabaseAdminClient() : createSupabaseServerClient();
  const { data, error } = await supabase
    .from("board_controls")
    .select(
      "board_id, updated_at, announcement, inputs_locked, locks, hud, reply_templates, pinned_question_ids, hidden_action_ids, resolved_help_ids, version",
    )
    .eq("board_id", boardId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const row = data as BoardControlsRow | null;
  if (!row) {
    if (options?.createIfMissing) {
      const insertPayload = buildDefaultControlsRow(boardId);
      const { error: insertError } = await supabase.from("board_controls").upsert(insertPayload, {
        onConflict: "board_id",
      });
      if (insertError) {
        throw new Error(insertError.message);
      }
    }
    return buildDefaultControls(boardId);
  }
  return mapRow(row);
}

export async function getBoardControlsByShareCode(code: string): Promise<BoardControls | null> {
  const board = await getBoardByShareCode(code);
  if (!board) return null;
  return getBoardControls(board.id, { useServiceRole: true });
}
