import {
  DASHBOARD_LAYOUT_TEMPLATES,
  getDashboardLayoutTemplate,
} from "@/lib/teacherPrefs/layoutTemplates";
import {
  DEFAULT_TEACHER_UI_PREFS,
  mergeTeacherUiPrefs,
  type TeacherUiPrefs,
  type TeacherUiPrefsPatch,
} from "@/lib/teacherPrefs/schema";

export type CustomizeDraftState = {
  saved: TeacherUiPrefs;
  draft: TeacherUiPrefs;
  currentTemplateId: string | null;
};

export type CustomizeDraftHistoryState = CustomizeDraftState & {
  undoStack: TeacherUiPrefs[];
};

export function createCustomizeDraftState(initial: TeacherUiPrefs): CustomizeDraftState {
  const matchedTemplateId = deriveCurrentTemplateId(initial);
  return { saved: initial, draft: initial, currentTemplateId: matchedTemplateId };
}

export function saveCustomizeDraft(state: CustomizeDraftState): CustomizeDraftState {
  const matchedTemplateId = deriveCurrentTemplateId(state.draft);
  return { ...state, saved: state.draft, currentTemplateId: matchedTemplateId };
}

export function revertCustomizeDraft(state: CustomizeDraftState): CustomizeDraftState {
  const matchedTemplateId = deriveCurrentTemplateId(state.saved);
  return { ...state, draft: state.saved, currentTemplateId: matchedTemplateId };
}

export function hasCustomizeDraftChanges(state: CustomizeDraftState): boolean {
  return JSON.stringify(state.saved) !== JSON.stringify(state.draft);
}

export function resetCustomizeDraftToDefault(): CustomizeDraftState {
  const matchedTemplateId = deriveCurrentTemplateId(DEFAULT_TEACHER_UI_PREFS);
  return { saved: DEFAULT_TEACHER_UI_PREFS, draft: DEFAULT_TEACHER_UI_PREFS, currentTemplateId: matchedTemplateId };
}

export function applyCustomizeDraftPatchWithUndo(
  state: CustomizeDraftHistoryState,
  patch: TeacherUiPrefsPatch,
): CustomizeDraftHistoryState {
  const nextDraft = mergeTeacherUiPrefs(state.draft, patch);
  return {
    ...state,
    undoStack: [...state.undoStack.slice(-29), state.draft],
    draft: nextDraft,
    currentTemplateId: deriveCurrentTemplateId(nextDraft),
  };
}

export function applyCustomizeLayoutTemplate(state: CustomizeDraftHistoryState, templateId: string): CustomizeDraftHistoryState {
  const template = getDashboardLayoutTemplate(templateId);
  if (!template) return state;
  return applyCustomizeDraftPatchWithUndo({ ...state, currentTemplateId: template.id }, template.tokenPreset);
}

export function deriveCurrentTemplateId(prefs: TeacherUiPrefs): string | null {
  const matched = DASHBOARD_LAYOUT_TEMPLATES.find((template) =>
    Object.entries(template.tokenPreset).every(([key, value]) => prefs[key as keyof TeacherUiPrefs] === value),
  );
  return matched?.id ?? null;
}
