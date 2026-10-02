import { AUDIT_ACTIONS } from "@/lib/data/auditActions";
import { getDashboardLayoutTemplate } from "@/lib/teacherPrefs/layoutTemplates";
import {
  DEFAULT_TEACHER_UI_PREFS,
  type TeacherUiPrefs,
  mergeTeacherUiPrefs,
  normalizeTeacherUiPrefs,
  normalizeTeacherUiPrefsPatch,
} from "@/lib/teacherPrefs/schema";
import { sanitizeTeacherUiPresetV2List } from "@/lib/teacherPrefs/customPresetV2";

const FONT_FAMILY_TOKENS: Record<TeacherUiPrefs["fontFamily"], string> = {
  suit: '"SUIT", "Pretendard", "Pretendard Variable", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", "Helvetica", "Arial", sans-serif',
  pretendard:
    '"Pretendard", "Pretendard Variable", "SUIT", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "Segoe UI", "Helvetica", "Arial", sans-serif',
  notoSansKr:
    '"Noto Sans KR", "SUIT", "Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", "Helvetica", "Arial", sans-serif',
  system: '"Apple SD Gothic Neo", "Malgun Gothic", "Segoe UI", "Helvetica", "Arial", sans-serif',
};

const DENSITY_TOKENS: Record<TeacherUiPrefs["density"], string> = {
  spacious: "1.08",
  comfortable: "1",
  compact: "0.86",
};

const PRESET_KEY = "teacherUiCustomPresetsV2";

export const DASHBOARD_CUSTOM_PAGE_RENDER_PRESET_LIMIT = 20;
export const DASHBOARD_CUSTOM_PAGE_RENDER_ACTION = AUDIT_ACTIONS.dashboardCustomPageRendered;

export function resolveCustomPagePrefs(
  classPrefs: Record<string, unknown> | null | undefined,
  options: { presetId?: string | null; templateId?: string | null } = {},
) {
  const base = normalizeTeacherUiPrefs(classPrefs?.teacherUiPrefs) ?? DEFAULT_TEACHER_UI_PREFS;
  const presets = sanitizeTeacherUiPresetV2List(classPrefs?.[PRESET_KEY]).slice(0, DASHBOARD_CUSTOM_PAGE_RENDER_PRESET_LIMIT);

  let resolved = base;
  let presetName: string | null = null;
  let source: "teacher_ui_prefs" | "template" | "preset" = "teacher_ui_prefs";

  const templateId = options.templateId?.trim();
  if (templateId) {
    const template = getDashboardLayoutTemplate(templateId);
    if (template) {
      const patch = normalizeTeacherUiPrefsPatch(template.tokenPreset) ?? {};
      resolved = mergeTeacherUiPrefs(resolved, patch);
      source = "template";
    }
  }

  const presetId = options.presetId?.trim();
  if (presetId) {
    const matched = presets.find((item) => item.id === presetId);
    if (matched) {
      resolved = mergeTeacherUiPrefs(resolved, matched.prefs);
      source = "preset";
      presetName = matched.name;
    }
  }

  return { prefs: resolved, presets, source, presetName };
}

export function buildTeacherPrefsCssVars(prefs: TeacherUiPrefs): Record<string, string> {
  const background =
    prefs.backgroundMode === "gradient"
      ? prefs.backgroundGradient
      : prefs.backgroundMode === "image" && prefs.backgroundImageUrl
        ? `url(${prefs.backgroundImageUrl}) center / cover no-repeat`
        : prefs.backgroundColor;

  return {
    "--dashboard-font-family": FONT_FAMILY_TOKENS[prefs.fontFamily],
    "--dashboard-font-size": `${prefs.baseFontSize}px`,
    "--dashboard-density": DENSITY_TOKENS[prefs.density],
    "--dashboard-card-radius": `${prefs.dashboardCardRadius}px`,
    "--dashboard-accent": prefs.accentColor,
    "--dashboard-foreground": prefs.theme === "dark" ? "#e2e8f0" : prefs.textColor,
    "--dashboard-background": prefs.theme === "dark" ? "#020617" : prefs.backgroundColor,
    "--dashboard-background-fill": background,
  };
}
