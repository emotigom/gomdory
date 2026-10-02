import assert from "node:assert/strict";
import test from "node:test";

import {
  assertUniqueActionIdsAndLabels,
  getCapabilitySet,
  resolveActions,
  type AppAction,
} from "@/lib/ui/actions/registry";
import { getStudentBoardActions } from "@/lib/ui/actions/screenActions";

test("advanced actions are hidden when showAdvancedActions=false", () => {
  const context = {
    activeWallId: "wall-1",
    activeWallTitle: "섹션",
    writeLocked: false,
    hasSelectedCard: true,
    openCompose: () => {},
    copyShareLink: () => {},
    copyColumnLink: () => {},
    openCardDetail: () => {},
    copyCardLink: () => {},
  };
  const actions = getStudentBoardActions(context);
  const resolved = resolveActions(actions, context, "context", {
    showAdvancedActions: false,
    capabilities: getCapabilitySet("StudentBoard", { showAdvancedActions: false }),
  });
  assert.equal(resolved.length, 0);
});

test("student/share context does not resolve teacher soft-delete actions", () => {
  const context = {
    ok: true,
  };
  const actions: AppAction<typeof context>[] = [
    {
      id: "teacher-soft-delete",
      label: "휴지통으로 이동",
      group: "card",
      dangerous: true,
      requires: ["teacher", "canSoftDelete", "showAdvancedActions"],
      advanced: true,
      surfaces: ["context"],
      when: () => true,
      run: () => {},
    },
  ];

  const resolvedStudent = resolveActions(actions, context, "context", {
    showAdvancedActions: true,
    capabilities: getCapabilitySet("StudentBoard", { showAdvancedActions: true }),
  });

  const resolvedShare = resolveActions(actions, context, "context", {
    showAdvancedActions: true,
    capabilities: getCapabilitySet("Share", { showAdvancedActions: true }),
  });

  assert.equal(resolvedStudent.length, 0);
  assert.equal(resolvedShare.length, 0);
});

test("assertUniqueActionIdsAndLabels guards duplicates", () => {
  const actions: AppAction<{ ok: boolean }>[] = [
    {
      id: "dup",
      label: "중복",
      group: "g",
      surfaces: ["palette"],
      when: () => true,
      run: () => {},
    },
    {
      id: "dup",
      label: "중복2",
      group: "g",
      surfaces: ["palette"],
      when: () => true,
      run: () => {},
    },
  ];

  assert.throws(() => assertUniqueActionIdsAndLabels(actions), /Duplicate action id/);
});
