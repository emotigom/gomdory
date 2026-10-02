import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_LESSON_SCENES } from "@/lib/coding-studio/lessons";
import { buildExecutionPlan, createInitialStudioRuntimeState, stepStudioProgram } from "@/lib/coding-studio/interpreter";

import type { StudioIrInstruction } from "@/lib/coding-studio/ir";

test("interpreter moves agent and updates pointer", () => {
  const scene = STUDIO_LESSON_SCENES["goal-move"];
  const state = createInitialStudioRuntimeState(scene);
  const plan: StudioIrInstruction[] = buildExecutionPlan([{ kind: "move", distance: 1 }]);

  const snap = stepStudioProgram({ plan, pointer: 0, scene, state });
  assert.equal(snap.pointer, 1);
  assert.equal(snap.state.x > 0, true);
});

test("interpreter executes sensor condition branch", () => {
  const scene = STUDIO_LESSON_SCENES["sensor-branch"];
  const state = createInitialStudioRuntimeState(scene);
  const plan: StudioIrInstruction[] = buildExecutionPlan([{ kind: "if_sensor", children: [{ kind: "turn", degrees: 45 }] }]);

  const snap = stepStudioProgram({ plan, pointer: 0, scene, state });
  assert.equal(snap.pointer, 1);
  assert.equal(snap.events.length > 0, true);
});

test("interpreter reset state returns to clean known coordinates", () => {
  const scene = STUDIO_LESSON_SCENES["turn-pivot"];
  const initial = createInitialStudioRuntimeState(scene);
  const plan: StudioIrInstruction[] = buildExecutionPlan([
    { kind: "set_color", color: "#ff0000" },
    { kind: "set_goal", x: 9, z: 9 },
  ]);

  const mutated = stepStudioProgram({ plan, pointer: 0, scene, state: initial });
  const moved = stepStudioProgram({ plan, pointer: 1, scene, state: mutated.state });
  const reset = createInitialStudioRuntimeState(scene);

  assert.notEqual(moved.state.color, reset.color);
  assert.notEqual(moved.state.targetX, reset.targetX);
  assert.notEqual(moved.state.targetZ, reset.targetZ);
  assert.equal(reset.x, scene.start.x);
  assert.equal(reset.z, scene.start.z);
  assert.equal(reset.heading, scene.start.heading);
  assert.equal(reset.stepCount, 0);
});


test("interpreter reset state is deterministic and returns fresh objects", () => {
  const scene = STUDIO_LESSON_SCENES["goal-move"];
  const resetA = createInitialStudioRuntimeState(scene);
  const resetB = createInitialStudioRuntimeState(scene);

  assert.deepEqual(resetA, resetB);
  assert.notEqual(resetA, resetB);

  resetA.x = 99;
  assert.equal(resetB.x, scene.start.x);
});
