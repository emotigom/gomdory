export type SelectionState = {
  selectedIds: Set<string>;
  lastSelectedId: string | null;
};

type ToggleAction = {
  type: "toggle";
  id: string;
  itemIds: string[];
  rangeIds?: string[];
  range?: boolean;
  additive?: boolean;
};

type SetAction = {
  type: "set";
  ids: string[];
};

type ClearAction = { type: "clear" };

type SyncAction = { type: "sync"; itemIds: string[] };

export type SelectionAction = ToggleAction | SetAction | ClearAction | SyncAction;

export function getRangeSelection(ids: string[], startId: string, endId: string): string[] {
  const startIndex = ids.indexOf(startId);
  const endIndex = ids.indexOf(endId);

  if (startIndex === -1 || endIndex === -1) {
    return [endId];
  }

  const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex];

  return ids.slice(from, to + 1);
}

export function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  if (action.type === "clear") {
    return { selectedIds: new Set(), lastSelectedId: null };
  }

  if (action.type === "set") {
    return {
      selectedIds: new Set(action.ids),
      lastSelectedId: action.ids.at(-1) ?? null,
    };
  }

  if (action.type === "sync") {
    const synced = new Set<string>();
    action.itemIds.forEach((id) => {
      if (state.selectedIds.has(id)) {
        synced.add(id);
      }
    });

    return {
      selectedIds: synced,
      lastSelectedId:
        state.lastSelectedId && action.itemIds.includes(state.lastSelectedId)
          ? state.lastSelectedId
          : null,
    };
  }

  const next = new Set(action.additive ? state.selectedIds : []);

  if (action.range && state.lastSelectedId) {
    const idsForRange = action.rangeIds ?? action.itemIds;
    getRangeSelection(idsForRange, state.lastSelectedId, action.id).forEach((id) => {
      next.add(id);
    });
  } else if (next.has(action.id)) {
    next.delete(action.id);
  } else {
    next.add(action.id);
  }

  return {
    selectedIds: next,
    lastSelectedId: action.id,
  };
}
