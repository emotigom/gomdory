import { z } from "zod";

import {
  DEFAULT_TEACHER_UI_PREFS,
  type TeacherUiPrefs,
  mergeTeacherUiPrefs,
  normalizeTeacherUiPrefs,
  normalizeTeacherUiPrefsPatch,
} from "@/lib/teacherPrefs/schema";

export const TEACHER_UI_PRESET_V2_LIMIT = 20;
const TEACHER_UI_PRESET_NAME_MAX_LENGTH = 40;
const TEACHER_UI_PRESET_PAYLOAD_LIMIT = 20_000;
const SAFE_NAME_PATTERN = /^[\p{L}\p{N}\s._-]+$/u;

export type TeacherUiCustomPresetV2 = {
  id: string;
  name: string;
  prefs: TeacherUiPrefs;
  createdAt: string;
  updatedAt: string;
};

const presetSchema = z.object({
  id: z.string().min(6).max(80),
  name: z.string().min(1).max(TEACHER_UI_PRESET_NAME_MAX_LENGTH),
  prefs: z.unknown(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

function sanitizePresetName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (!SAFE_NAME_PATTERN.test(trimmed)) return null;
  return trimmed;
}

function nowIso() {
  return new Date().toISOString();
}

export function sanitizeTeacherUiPresetV2List(input: unknown): TeacherUiCustomPresetV2[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((value) => {
      const parsed = presetSchema.safeParse(value);
      if (!parsed.success) return null;
      const normalizedName = sanitizePresetName(parsed.data.name);
      if (!normalizedName) return null;
      const prefs = normalizeTeacherUiPrefs(parsed.data.prefs);
      if (!prefs) return null;
      return {
        id: parsed.data.id,
        name: normalizedName,
        prefs,
        createdAt: parsed.data.createdAt,
        updatedAt: parsed.data.updatedAt,
      } satisfies TeacherUiCustomPresetV2;
    })
    .filter((value): value is TeacherUiCustomPresetV2 => Boolean(value))
    .slice(0, TEACHER_UI_PRESET_V2_LIMIT);
}

function ensurePayloadSize(next: TeacherUiCustomPresetV2[]) {
  return JSON.stringify(next).length <= TEACHER_UI_PRESET_PAYLOAD_LIMIT;
}

export function createTeacherUiPresetV2(
  list: TeacherUiCustomPresetV2[],
  params: { name: string; prefs: unknown },
): { ok: true; presets: TeacherUiCustomPresetV2[] } | { ok: false; code: string; message: string } {
  const nextName = sanitizePresetName(params.name);
  if (!nextName) {
    return { ok: false, code: "INVALID_PRESET_NAME", message: "프리셋 이름 형식이 올바르지 않습니다." };
  }
  if (list.length >= TEACHER_UI_PRESET_V2_LIMIT) {
    return { ok: false, code: "PRESET_LIMIT_REACHED", message: "프리셋은 최대 20개까지 저장할 수 있습니다." };
  }

  const patch = normalizeTeacherUiPrefsPatch(params.prefs);
  const resolvedPrefs = mergeTeacherUiPrefs(DEFAULT_TEACHER_UI_PREFS, patch ?? {});
  const stamp = nowIso();
  const created: TeacherUiCustomPresetV2 = {
    id: `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: nextName,
    prefs: resolvedPrefs,
    createdAt: stamp,
    updatedAt: stamp,
  };

  const next = [created, ...list];
  if (!ensurePayloadSize(next)) {
    return { ok: false, code: "PRESET_TOO_LARGE", message: "프리셋 데이터가 너무 큽니다." };
  }
  return { ok: true, presets: next };
}

export function renameTeacherUiPresetV2(
  list: TeacherUiCustomPresetV2[],
  params: { id: string; name: string },
): { ok: true; presets: TeacherUiCustomPresetV2[] } | { ok: false; code: string; message: string } {
  const nextName = sanitizePresetName(params.name);
  if (!nextName) {
    return { ok: false, code: "INVALID_PRESET_NAME", message: "프리셋 이름 형식이 올바르지 않습니다." };
  }
  const updated = list.map((preset) =>
    preset.id === params.id ? { ...preset, name: nextName, updatedAt: nowIso() } : preset,
  );
  if (!updated.some((preset) => preset.id === params.id)) {
    return { ok: false, code: "PRESET_NOT_FOUND", message: "프리셋을 찾을 수 없습니다." };
  }
  return { ok: true, presets: updated };
}

export function deleteTeacherUiPresetV2(
  list: TeacherUiCustomPresetV2[],
  id: string,
): { ok: true; presets: TeacherUiCustomPresetV2[] } | { ok: false; code: string; message: string } {
  const next = list.filter((preset) => preset.id !== id);
  if (next.length === list.length) {
    return { ok: false, code: "PRESET_NOT_FOUND", message: "프리셋을 찾을 수 없습니다." };
  }
  return { ok: true, presets: next };
}
