import assert from "node:assert/strict";
import test from "node:test";

import {
  createTeacherUiPresetV2,
  deleteTeacherUiPresetV2,
  renameTeacherUiPresetV2,
  TEACHER_UI_PRESET_V2_LIMIT,
} from "@/lib/teacherPrefs/customPresetV2";
import { DEFAULT_TEACHER_UI_PREFS } from "@/lib/teacherPrefs/schema";

test("preset v2 CRUD keeps sanitized prefs and supports rename/delete", () => {
  const created = createTeacherUiPresetV2([], { name: "내 프리셋", prefs: { backgroundColor: "#000000" } });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const preset = created.presets[0];
  assert.equal(preset.prefs.backgroundColor, "#000000");

  const renamed = renameTeacherUiPresetV2(created.presets, { id: preset.id, name: "수정된 이름" });
  assert.equal(renamed.ok, true);
  if (!renamed.ok) return;
  assert.equal(renamed.presets[0].name, "수정된 이름");

  const deleted = deleteTeacherUiPresetV2(renamed.presets, preset.id);
  assert.equal(deleted.ok, true);
  if (!deleted.ok) return;
  assert.equal(deleted.presets.length, 0);
});

test("preset v2 validation rejects invalid names and max limit", () => {
  const invalid = createTeacherUiPresetV2([], { name: "<script>", prefs: {} });
  assert.equal(invalid.ok, false);

  let list = [] as NonNullable<Extract<ReturnType<typeof createTeacherUiPresetV2>, { ok: true }>["presets"]>;
  for (let index = 0; index < TEACHER_UI_PRESET_V2_LIMIT; index += 1) {
    const created = createTeacherUiPresetV2(list, { name: `preset-${index + 1}`, prefs: DEFAULT_TEACHER_UI_PREFS });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    list = created.presets;
  }

  const overflow = createTeacherUiPresetV2(list, { name: "overflow", prefs: DEFAULT_TEACHER_UI_PREFS });
  assert.equal(overflow.ok, false);
});


test("preset v2 enforces payload size limit", () => {
  const largeButValidUrl = `https://example.com/${"a".repeat(1900)}`;
  let list = [] as NonNullable<Extract<ReturnType<typeof createTeacherUiPresetV2>, { ok: true }>["presets"]>;
  let payloadLimitHit = false;

  for (let index = 0; index < TEACHER_UI_PRESET_V2_LIMIT; index += 1) {
    const created = createTeacherUiPresetV2(list, {
      name: `heavy-${index + 1}`,
      prefs: { backgroundMode: "image", backgroundImageUrl: largeButValidUrl },
    });

    if (!created.ok) {
      assert.equal(created.code, "PRESET_TOO_LARGE");
      payloadLimitHit = true;
      break;
    }

    list = created.presets;
  }

  assert.equal(payloadLimitHit, true);
});
