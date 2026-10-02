import type { StudioBlockNode } from "./types";

export type StudioIrInstruction =
  | { kind: "move"; distance: number }
  | { kind: "turn"; degrees: number }
  | { kind: "wait"; ticks: number }
  | { kind: "set_color"; color: string }
  | { kind: "set_goal"; x: number; z: number }
  | { kind: "if_sensor"; children: StudioIrInstruction[] }
  | { kind: "repeat"; count: number; children: StudioIrInstruction[] };

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function compileSingle(node: StudioBlockNode): StudioIrInstruction[] {
  switch (node.type) {
    case "start":
      return [];
    case "move":
      return [{ kind: "move", distance: toNumber(node.params?.distance, 1) }];
    case "turn":
      return [{ kind: "turn", degrees: toNumber(node.params?.degrees, 45) }];
    case "wait":
      return [{ kind: "wait", ticks: Math.max(1, Math.floor(toNumber(node.params?.ticks, 1))) }];
    case "set_color":
      return [{ kind: "set_color", color: typeof node.params?.color === "string" ? node.params.color : "#8ec5ff" }];
    case "set_goal":
      return [{ kind: "set_goal", x: toNumber(node.params?.x, 3), z: toNumber(node.params?.z, 0) }];
    case "if_sensor":
      return [{ kind: "if_sensor", children: compileBlocksToIr(node.children ?? []) }];
    case "repeat":
      return [{ kind: "repeat", count: Math.max(1, Math.floor(toNumber(node.params?.count, 2))), children: compileBlocksToIr(node.children ?? []) }];
    default:
      return [];
  }
}

export function compileBlocksToIr(blocks: StudioBlockNode[]): StudioIrInstruction[] {
  return blocks.flatMap((block) => compileSingle(block));
}
