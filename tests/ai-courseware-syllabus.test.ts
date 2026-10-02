import test from "node:test";
import assert from "node:assert/strict";
import { AI_COURSEWARE_32_DAY_SYLLABUS } from "@/lib/edu/courseware/aiCoursewareSyllabus";

test("syllabus has complete 32-day data", () => {
  assert.equal(AI_COURSEWARE_32_DAY_SYLLABUS.length, 32);
  AI_COURSEWARE_32_DAY_SYLLABUS.forEach((d, idx) => {
    assert.equal(d.day, idx + 1);
    assert.ok(d.durationMinutes >= 45);
    if (d.day <= 16) {
      assert.equal(d.durationMinutes, 90);
      assert.ok(d.expansionMinutes >= 20);
      assert.ok(d.lessonFlow.length >= 6);
      assert.ok(d.extensionFlow.length >= 2);
      assert.ok(d.notebookLab.launchUrl.includes("jupyterlite"));
      assert.ok(d.interactiveActivity);
    }
    assert.ok(d.title.trim().length > 3);
    assert.ok(d.goals.length >= 3);
    assert.ok(d.lessonFlow.length >= 5);
    assert.ok(d.extensionFlow.length >= 1);
    assert.ok(d.studentMission.steps.length >= 3);
    assert.ok(d.studio.checklist.length >= 3);
    assert.ok(d.reflectionPrompts.length >= 2);
  });
});
