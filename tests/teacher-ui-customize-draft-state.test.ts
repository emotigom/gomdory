import assert from "node:assert/strict";
import test from "node:test";

import {
  applyCustomizeLayoutTemplate,
  createCustomizeDraftState,
  hasCustomizeDraftChanges,
  resetCustomizeDraftToDefault,
  revertCustomizeDraft,
  saveCustomizeDraft,
  applyCustomizeDraftPatchWithUndo,
  deriveCurrentTemplateId,
} from "@/lib/teacherPrefs/customizeDraft";
import { DEFAULT_TEACHER_UI_PREFS, mergeTeacherUiPrefs } from "@/lib/teacherPrefs/schema";

test("customize draft save and revert returns to last saved state", () => {
  const initial = createCustomizeDraftState(DEFAULT_TEACHER_UI_PREFS);
  const changedDraft = {
    ...initial,
    draft: mergeTeacherUiPrefs(initial.draft, { backgroundColor: "#111111" }),
  };

  const saved = saveCustomizeDraft(changedDraft);
  const changedAgain = {
    ...saved,
    draft: mergeTeacherUiPrefs(saved.draft, { backgroundColor: "#222222" }),
  };

  const reverted = revertCustomizeDraft(changedAgain);
  assert.equal(reverted.draft.backgroundColor, "#111111");
});

test("customize draft reset returns default preset", () => {
  const reset = resetCustomizeDraftToDefault();
  assert.deepEqual(reset.saved, DEFAULT_TEACHER_UI_PREFS);
  assert.deepEqual(reset.draft, DEFAULT_TEACHER_UI_PREFS);
  assert.equal(reset.currentTemplateId, deriveCurrentTemplateId(DEFAULT_TEACHER_UI_PREFS));
});

test("customize draft unsaved state toggles around save", () => {
  const initial = createCustomizeDraftState(DEFAULT_TEACHER_UI_PREFS);
  assert.equal(hasCustomizeDraftChanges(initial), false);

  const changed = {
    ...initial,
    draft: mergeTeacherUiPrefs(initial.draft, { theme: "dark" }),
  };
  assert.equal(hasCustomizeDraftChanges(changed), true);

  const saved = saveCustomizeDraft(changed);
  assert.equal(hasCustomizeDraftChanges(saved), false);
  assert.equal(saved.currentTemplateId, deriveCurrentTemplateId(saved.draft));
});


test("customize draft template apply mutates draft and pushes undo stack", () => {
  const initial = {
    ...createCustomizeDraftState(DEFAULT_TEACHER_UI_PREFS),
    undoStack: [],
  };

  const next = applyCustomizeDraftPatchWithUndo(initial, { density: "compact", dashboardCardRadius: 10 });
  assert.equal(next.draft.density, "compact");
  assert.equal(next.draft.dashboardCardRadius, 10);
  assert.equal(next.undoStack.length, 1);
  assert.deepEqual(next.undoStack[0], DEFAULT_TEACHER_UI_PREFS);
});

test("customize draft template switch keeps currentTemplateId in sync", () => {
  const initial = {
    ...createCustomizeDraftState(DEFAULT_TEACHER_UI_PREFS),
    undoStack: [],
  };

  const denseApplied = applyCustomizeLayoutTemplate(initial, "dense");
  assert.equal(denseApplied.currentTemplateId, "dense");

  const edited = applyCustomizeDraftPatchWithUndo(denseApplied, { dashboardCardRadius: 11 });
  assert.equal(edited.currentTemplateId, null);

  const saved = saveCustomizeDraft(edited);
  assert.equal(saved.currentTemplateId, null);

  const reverted = revertCustomizeDraft({ ...saved, draft: mergeTeacherUiPrefs(saved.draft, { dashboardCardRadius: 10 }) });
  assert.equal(reverted.currentTemplateId, null);
});
