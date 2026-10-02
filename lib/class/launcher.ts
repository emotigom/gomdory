export type LaunchTarget =
  | { type: "run_preset"; presetId: string; boardId: string }
  | { type: "open_class"; boardId: string };

export type LaunchMode = "class" | "present" | "share";

export type LaunchPreset = {
  id: string;
  target: LaunchMode;
};

type LaunchBoard = {
  id: string;
};

type LaunchOptions = {
  recentPresetId?: string | null;
};

export function getLaunchTargetForBoard(
  board: LaunchBoard,
  presets: LaunchPreset[] = [],
  mode: LaunchMode = "class",
  options?: LaunchOptions,
): LaunchTarget {
  const candidates = presets.filter((preset) => preset.target === mode);
  const recentPreset = options?.recentPresetId
    ? candidates.find((preset) => preset.id === options.recentPresetId) ?? null
    : null;
  const selected = recentPreset ?? candidates[0] ?? null;

  if (selected) {
    return { type: "run_preset", presetId: selected.id, boardId: board.id };
  }

  return { type: "open_class", boardId: board.id };
}
