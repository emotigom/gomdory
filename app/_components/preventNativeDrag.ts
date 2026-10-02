import type { DragEvent } from "react";

export function preventNativeDragProps(): {
  onDragStartCapture: (event: DragEvent) => void;
  draggable: false;
} {
  return {
    onDragStartCapture: (event) => {
      event.preventDefault();
    },
    draggable: false,
  };
}
