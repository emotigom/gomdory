"use client";

import type { CSSProperties, ReactNode, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type AnchoredMenuProps = {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  menuRef?: RefObject<HTMLDivElement | null>;
  cssVariableSourceRef?: RefObject<HTMLElement | null>;
  cssVariableNames?: readonly string[];
  align?: "left" | "right";
  offset?: number;
  showBackdrop?: boolean;
  onBackdropClick?: () => void;
  className?: string;
  style?: CSSProperties;
  role?: string;
  children: ReactNode;
};

type MenuPosition = {
  top: number;
  left: number;
  maxHeight: number;
};

const VIEWPORT_MARGIN = 12;

export default function AnchoredMenu({
  open,
  anchorRef,
  menuRef: providedMenuRef,
  cssVariableSourceRef,
  cssVariableNames,
  align = "right",
  offset = 8,
  showBackdrop: _showBackdrop = false,
  onBackdropClick: _onBackdropClick,
  className,
  style,
  role,
  children,
}: AnchoredMenuProps) {
  void _showBackdrop;
  void _onBackdropClick;

  const fallbackRef = useRef<HTMLDivElement | null>(null);
  const menuRef = providedMenuRef ?? fallbackRef;
  const [position, setPosition] = useState<MenuPosition | null>(null);

  const syncCssVariables = useCallback(() => {
    const source = cssVariableSourceRef?.current;
    const menu = menuRef.current;
    if (!source || !menu || !cssVariableNames?.length) return;

    const sourceStyle = window.getComputedStyle(source);
    for (const variableName of cssVariableNames) {
      const value = sourceStyle.getPropertyValue(variableName).trim();
      if (value) menu.style.setProperty(variableName, value);
      else menu.style.removeProperty(variableName);
    }
  }, [cssVariableNames, cssVariableSourceRef, menuRef]);

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const menu = menuRef.current;
    if (!anchor || !menu) return;

    const anchorRect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let top = anchorRect.bottom + offset;
    const maxBelow = viewportHeight - VIEWPORT_MARGIN - top;
    if (maxBelow < menuRect.height) {
      const aboveTop = anchorRect.top - offset - menuRect.height;
      if (aboveTop >= VIEWPORT_MARGIN || maxBelow < menuRect.height / 2) {
        top = Math.max(VIEWPORT_MARGIN, anchorRect.top - offset - menuRect.height);
      }
    }

    let left = align === "left" ? anchorRect.left : anchorRect.right - menuRect.width;
    left = Math.min(
      Math.max(left, VIEWPORT_MARGIN),
      Math.max(VIEWPORT_MARGIN, viewportWidth - menuRect.width - VIEWPORT_MARGIN),
    );

    const maxHeight = Math.max(
      120,
      Math.min(viewportHeight - VIEWPORT_MARGIN - top, viewportHeight - VIEWPORT_MARGIN * 2),
    );

    setPosition({ top, left, maxHeight });
  }, [align, anchorRef, menuRef, offset]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }
    syncCssVariables();
    updatePosition();
  }, [open, syncCssVariables, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const handleUpdate = () => updatePosition();
    window.addEventListener("resize", handleUpdate);
    window.addEventListener("scroll", handleUpdate, true);
    return () => {
      window.removeEventListener("resize", handleUpdate);
      window.removeEventListener("scroll", handleUpdate, true);
    };
  }, [open, updatePosition]);

  if (!open) return null;

  const computedStyle: CSSProperties = {
    position: "fixed",
    top: position?.top ?? 0,
    left: position?.left ?? 0,
    maxHeight: position?.maxHeight,
    opacity: position ? 1 : 0,
    pointerEvents: position ? "auto" : "none",
    ...style,
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        role={role}
        data-interactive="true"
        data-dismiss-ignore="true"
        className={`z-[9999] overflow-y-auto ${className ?? ""}`}
        style={computedStyle}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
