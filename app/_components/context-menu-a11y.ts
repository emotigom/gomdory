export type ContextMenuKey = "ArrowDown" | "ArrowUp" | "Home" | "End" | "Escape";

export function handleContextMenuKeydown(params: {
  key: string;
  itemCount: number;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  onClose: () => void;
  onRestoreFocus: () => void;
  preventDefault: () => void;
}) {
  const { key, itemCount, activeIndex, onActiveIndexChange, onClose, onRestoreFocus, preventDefault } = params;

  if (key === "Escape") {
    preventDefault();
    onClose();
    onRestoreFocus();
    return;
  }

  if (itemCount <= 0) return;

  if (key === "ArrowDown") {
    preventDefault();
    onActiveIndexChange((activeIndex + 1) % itemCount);
    return;
  }

  if (key === "ArrowUp") {
    preventDefault();
    onActiveIndexChange((activeIndex - 1 + itemCount) % itemCount);
    return;
  }

  if (key === "Home") {
    preventDefault();
    onActiveIndexChange(0);
    return;
  }

  if (key === "End") {
    preventDefault();
    onActiveIndexChange(itemCount - 1);
  }
}
