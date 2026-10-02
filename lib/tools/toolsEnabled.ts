import { TOOL_DEFS, TOOL_IDS, type ToolId } from "./toolsRegistry";

const TOOL_ID_SET = new Set<string>(TOOL_IDS);

export function isToolId(value: string): value is ToolId {
  return TOOL_ID_SET.has(value);
}

export function normalizeToolsEnabled(input: unknown): ToolId[] {
  const raw = Array.isArray(input) ? input : typeof input === "string" ? [input] : [];
  const unique = new Set<ToolId>();

  for (const value of raw) {
    if (typeof value !== "string") continue;
    if (!isToolId(value)) continue;
    unique.add(value);
  }

  return Array.from(unique);
}

export function resolveToolsEnabled(opts: {
  board: unknown;
  teacherDefault?: unknown;
}): ToolId[] {
  const hasBoardValue = opts.board !== undefined && opts.board !== null;
  const boardTools = normalizeToolsEnabled(opts.board);
  if (hasBoardValue) {
    return boardTools;
  }

  const teacherTools = normalizeToolsEnabled(opts.teacherDefault);
  if (teacherTools.length === 0) {
    return TOOL_DEFS.map((tool) => tool.id);
  }

  const enabled = new Set<ToolId>(teacherTools);
  return TOOL_DEFS.map((tool) => tool.id).filter((toolId) => enabled.has(toolId));
}

export function hasToolEnabled(
  board: { tools_enabled?: unknown } | unknown,
  toolId: ToolId,
  teacherDefault?: unknown,
): boolean {
  const boardTools =
    board && typeof board === "object" && "tools_enabled" in board
      ? (board as { tools_enabled?: unknown }).tools_enabled
      : board;
  const enabledTools = resolveToolsEnabled({ board: boardTools, teacherDefault });
  return enabledTools.includes(toolId);
}
