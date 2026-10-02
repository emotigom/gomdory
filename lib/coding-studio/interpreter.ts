import type { StudioRuntimeSceneTemplate, StudioRuntimeState, StudioDebugEvent } from "./types";
import type { StudioIrInstruction } from "./ir";

export type StudioExecutionSnapshot = {
  state: StudioRuntimeState;
  pointer: number;
  finished: boolean;
  actionLabel: string;
  events: StudioDebugEvent[];
};

const DEG_TO_RAD = Math.PI / 180;

function cloneState(state: StudioRuntimeState): StudioRuntimeState {
  return { ...state };
}

function flatten(instructions: StudioIrInstruction[]): StudioIrInstruction[] {
  return instructions.flatMap((instruction) => {
    if (instruction.kind === "repeat") {
      return Array.from({ length: instruction.count }).flatMap(() => flatten(instruction.children));
    }
    return [instruction.kind === "if_sensor" ? { ...instruction, children: flatten(instruction.children) } : instruction];
  });
}

function isObstacleAhead(state: StudioRuntimeState, scene: StudioRuntimeSceneTemplate): boolean {
  const lookAhead = 1;
  const rad = state.heading * DEG_TO_RAD;
  const aheadX = state.x + Math.cos(rad) * lookAhead;
  const aheadZ = state.z + Math.sin(rad) * lookAhead;
  return scene.obstacles.some((obstacle) => Math.hypot(obstacle.x - aheadX, obstacle.z - aheadZ) <= obstacle.radius + 0.15);
}

function intersectsObstacle(nextX: number, nextZ: number, scene: StudioRuntimeSceneTemplate): boolean {
  return scene.obstacles.some((obstacle) => Math.hypot(obstacle.x - nextX, obstacle.z - nextZ) <= obstacle.radius + 0.25);
}

function evaluateGoal(state: StudioRuntimeState, scene: StudioRuntimeSceneTemplate): boolean {
  return Math.hypot(scene.goal.x - state.x, scene.goal.z - state.z) <= scene.goal.radius;
}

export function createInitialStudioRuntimeState(scene: StudioRuntimeSceneTemplate): StudioRuntimeState {
  return {
    x: scene.start.x,
    z: scene.start.z,
    heading: scene.start.heading,
    color: "#8ec5ff",
    targetX: scene.goal.x,
    targetZ: scene.goal.z,
    stepCount: 0,
    reachedGoal: false,
    blocked: false,
  };
}

export function buildExecutionPlan(ir: StudioIrInstruction[]): StudioIrInstruction[] {
  return flatten(ir);
}

export function stepStudioProgram(args: {
  plan: StudioIrInstruction[];
  pointer: number;
  state: StudioRuntimeState;
  scene: StudioRuntimeSceneTemplate;
}): StudioExecutionSnapshot {
  if (args.pointer >= args.plan.length) {
    return { state: cloneState(args.state), pointer: args.pointer, finished: true, actionLabel: "완료", events: [] };
  }

  const instruction = args.plan[args.pointer];
  const state = cloneState(args.state);
  const events: StudioDebugEvent[] = [];

  if (instruction.kind === "if_sensor") {
    const blockedAhead = isObstacleAhead(state, args.scene);
    events.push({ action: "감지", detail: blockedAhead ? "앞쪽 장애물 감지" : "앞쪽 경로 여유" });
    if (blockedAhead) {
      const nestedPlan = buildExecutionPlan(instruction.children);
      let nestedState = state;
      let nestedPointer = 0;
      while (nestedPointer < nestedPlan.length) {
        const nestedSnapshot = stepStudioProgram({
          plan: nestedPlan,
          pointer: nestedPointer,
          state: nestedState,
          scene: args.scene,
        });
        nestedState = nestedSnapshot.state;
        nestedPointer = nestedSnapshot.pointer;
        events.push(...nestedSnapshot.events);
        if (nestedSnapshot.finished) break;
      }
      nestedState.reachedGoal = evaluateGoal(nestedState, args.scene);
      return {
        state: nestedState,
        pointer: args.pointer + 1,
        finished: args.pointer + 1 >= args.plan.length,
        actionLabel: "감지 조건 실행",
        events,
      };
    }

    state.stepCount += 1;
    state.reachedGoal = evaluateGoal(state, args.scene);
    return {
      state,
      pointer: args.pointer + 1,
      finished: args.pointer + 1 >= args.plan.length,
      actionLabel: "감지 조건 통과",
      events,
    };
  }

  if (instruction.kind === "move") {
    const rad = state.heading * DEG_TO_RAD;
    const nextX = Number((state.x + Math.cos(rad) * instruction.distance).toFixed(3));
    const nextZ = Number((state.z + Math.sin(rad) * instruction.distance).toFixed(3));
    if (intersectsObstacle(nextX, nextZ, args.scene)) {
      state.blocked = true;
      events.push({ action: "이동", detail: "장애물에 막힘" });
    } else {
      state.x = nextX;
      state.z = nextZ;
      state.blocked = false;
      events.push({ action: "이동", detail: `x:${state.x.toFixed(1)} z:${state.z.toFixed(1)}` });
    }
  } else if (instruction.kind === "turn") {
    state.heading = (state.heading + instruction.degrees + 360) % 360;
    events.push({ action: "회전", detail: `${instruction.degrees}°` });
  } else if (instruction.kind === "wait") {
    events.push({ action: "대기", detail: `${instruction.ticks}틱` });
  } else if (instruction.kind === "set_color") {
    state.color = instruction.color;
    events.push({ action: "색상", detail: instruction.color });
  } else if (instruction.kind === "set_goal") {
    state.targetX = instruction.x;
    state.targetZ = instruction.z;
    events.push({ action: "목표", detail: `${instruction.x}, ${instruction.z}` });
  }

  state.stepCount += 1;
  state.reachedGoal = evaluateGoal(state, args.scene);

  return {
    state,
    pointer: args.pointer + 1,
    finished: args.pointer + 1 >= args.plan.length,
    actionLabel: events[0]?.action ?? "실행",
    events,
  };
}
