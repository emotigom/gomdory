export type GridSelectionState = {
  selectionMode: boolean;
  selectedCardIds: Set<string>;
};

export const initialGridSelectionState: GridSelectionState = {
  selectionMode: false,
  selectedCardIds: new Set<string>(),
};

export type GridSelectionAction =
  | { type: "toggle_mode" }
  | { type: "clear" }
  | { type: "esc" }
  | { type: "toggle_card"; cardId: string }
  | { type: "select_all"; cardIds: string[] };

export function reduceGridSelection(state: GridSelectionState, action: GridSelectionAction): GridSelectionState {
  if (action.type === "toggle_mode") {
    if (state.selectionMode) {
      return { selectionMode: false, selectedCardIds: new Set<string>() };
    }
    return { selectionMode: true, selectedCardIds: new Set(state.selectedCardIds) };
  }

  if (action.type === "clear" || action.type === "esc") {
    return { selectionMode: false, selectedCardIds: new Set<string>() };
  }

  if (action.type === "toggle_card") {
    const next = new Set(state.selectedCardIds);
    if (next.has(action.cardId)) {
      next.delete(action.cardId);
    } else {
      next.add(action.cardId);
    }
    return { selectionMode: true, selectedCardIds: next };
  }

  if (action.type === "select_all") {
    return { selectionMode: true, selectedCardIds: new Set(action.cardIds) };
  }

  return state;
}

export type BulkUndoEntry =
  | { kind: "move"; cardIds: string[]; fromWallIdByCardId: Record<string, string>; toWallId: string }
  | { kind: "delete"; cardIds: string[] };

export function pushOneDeepUndo(_current: BulkUndoEntry | null, next: BulkUndoEntry): BulkUndoEntry {
  return next;
}

export function popOneDeepUndo(current: BulkUndoEntry | null): { entry: BulkUndoEntry | null; next: null } {
  return { entry: current, next: null };
}
