export type FollowMode = "grid" | "focus";

export type FollowState = {
  boardId: string;
  wallId: string | null;
  focusedCardId: string | null;
  mode: FollowMode;
  updatedAt: number;
  updatedBy: string;
};

export type FollowStateUpdateInput = {
  boardId?: string | null;
  wallId?: string | null;
  focusedCardId?: string | null;
  mode?: string | null;
  updatedBy?: string | null;
};

export function normalizeFollowStateInput(input: FollowStateUpdateInput): FollowState | null {
  if (!input.boardId || typeof input.boardId !== "string") {
    return null;
  }

  const mode = input.mode === "focus" || input.mode === "grid" ? input.mode : null;
  if (!mode) {
    return null;
  }

  const wallId = input.wallId ?? null;
  const focusedCardId = mode === "focus" ? input.focusedCardId ?? null : null;

  return {
    boardId: input.boardId,
    wallId,
    focusedCardId,
    mode,
    updatedAt: Date.now(),
    updatedBy: input.updatedBy || "teacher",
  };
}
