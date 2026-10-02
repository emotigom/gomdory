"use client";

import { useCallback, useEffect, useMemo, useReducer } from "react";

import { selectionReducer } from "./selectionReducer";

type ToggleOptions = {
  range?: boolean;
  rangeIds?: string[];
  additive?: boolean;
};

export default function useSelection(itemIds: string[]) {
  const [state, dispatch] = useReducer(selectionReducer, {
    selectedIds: new Set<string>(),
    lastSelectedId: null,
  });

  useEffect(() => {
    dispatch({ type: "sync", itemIds });
  }, [itemIds]);

  const selectedCount = state.selectedIds.size;

  const selectedIdList = useMemo(() => Array.from(state.selectedIds), [state.selectedIds]);

  const isSelected = useCallback((id: string) => state.selectedIds.has(id), [state.selectedIds]);

  const clearSelection = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);

  const selectAll = useCallback(() => {
    dispatch({ type: "set", ids: itemIds });
  }, [itemIds]);

  const toggleSelection = useCallback(
    (id: string, options?: ToggleOptions) => {
      dispatch({
        type: "toggle",
        id,
        itemIds,
        range: options?.range,
        rangeIds: options?.rangeIds,
        additive: options?.additive,
      });
    },
    [itemIds],
  );

  const setSelectionIds = useCallback((ids: string[]) => {
    dispatch({ type: "set", ids });
  }, []);

  return {
    clearSelection,
    isSelected,
    selectedCount,
    selectedIdList,
    selectAll,
    setSelectionIds,
    toggleSelection,
  };
}
