"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

type ResizeEnable = {
  right?: boolean;
};

type ResizeDirection = "right";

type ResizeDelta = {
  width: number;
  height: number;
};

type ResizeStopHandler = (
  event: PointerEvent | MouseEvent,
  direction: ResizeDirection,
  ref: HTMLDivElement,
  delta: ResizeDelta,
) => void;

type ResizableProps = {
  enable?: ResizeEnable;
  minWidth?: number;
  maxWidth?: number;
  size?: {
    width?: number | string;
    height?: number | string;
  };
  handleComponent?: {
    right?: ReactNode;
  };
  onResizeStop?: ResizeStopHandler;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

export function Resizable({
  enable,
  minWidth,
  maxWidth,
  size,
  handleComponent,
  onResizeStop,
  className,
  style,
  children,
}: ResizableProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | undefined>(
    typeof size?.width === "number" ? size.width : undefined,
  );
  const widthRef = useRef<number | undefined>(width);

  useEffect(() => {
    if (typeof size?.width === "number") {
      setWidth(size.width);
      widthRef.current = size.width;
    }
  }, [size?.width]);

  const clampWidth = (nextWidth: number) => {
    const min = typeof minWidth === "number" ? minWidth : -Infinity;
    const max = typeof maxWidth === "number" ? maxWidth : Infinity;
    return Math.min(Math.max(nextWidth, min), max);
  };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!enable?.right || !wrapperRef.current) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = wrapperRef.current.offsetWidth;
    widthRef.current = startWidth;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextWidth = clampWidth(startWidth + deltaX);
      widthRef.current = nextWidth;
      setWidth(nextWidth);
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      if (wrapperRef.current && onResizeStop) {
        const finalWidth = widthRef.current ?? wrapperRef.current.offsetWidth;
        const delta = {
          width: finalWidth - startWidth,
          height: 0,
        };
        onResizeStop(upEvent, "right", wrapperRef.current, delta);
      }
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  const resolvedStyle: CSSProperties = {
    ...style,
  };

  if (typeof size?.height !== "undefined") {
    resolvedStyle.height = size.height;
  }

  if (typeof size?.width === "string") {
    resolvedStyle.width = size.width;
  } else if (typeof width === "number") {
    resolvedStyle.width = width;
  }

  const wrapperClassName = ["relative", className].filter(Boolean).join(" ");

  return (
    <div ref={wrapperRef} className={wrapperClassName} style={resolvedStyle}>
      {children}
      {enable?.right ? (
        <div
          role="separator"
          aria-orientation="vertical"
          tabIndex={0}
          onPointerDown={startResize}
          className="absolute right-0 top-0 h-full w-2 cursor-ew-resize"
        >
          {handleComponent?.right}
        </div>
      ) : null}
    </div>
  );
}

export default Resizable;
