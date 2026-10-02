"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { handleContextMenuKeydown } from "./context-menu-a11y";

type ContextMenuProps = {
  isOpen: boolean;
  x: number;
  y: number;
  ariaLabel: string;
  className: string;
  children: ReactNode;
  onClose: () => void;
};

export default function ContextMenu({ isOpen, x, y, ariaLabel, className, children, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const restoreFocus = useCallback(() => {
    const restoreTarget = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (!restoreTarget) return;
    requestAnimationFrame(() => {
      restoreTarget.focus({ preventScroll: true });
    });
  }, []);

  useEffect(() => {
    if (!isOpen) {
      restoreFocus();
      return;
    }

    const activeElement = document.activeElement;
    restoreFocusRef.current = activeElement instanceof HTMLElement ? activeElement : null;

    requestAnimationFrame(() => {
      const root = menuRef.current;
      if (!root) return;
      const items = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]):not([disabled])'));
      const target = items[0] ?? root;
      setActiveIndex(0);
      target.focus({ preventScroll: true });
    });

    return () => {
      restoreFocus();
    };
  }, [isOpen, restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDownOutside = (event: PointerEvent) => {
      const root = menuRef.current;
      if (!root) return;
      if (event.target instanceof Node && !root.contains(event.target)) {
        onClose();
      }
    };

    const handleDocumentEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onClose();
      restoreFocus();
    };

    document.addEventListener("pointerdown", handlePointerDownOutside, true);
    document.addEventListener("keydown", handleDocumentEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDownOutside, true);
      document.removeEventListener("keydown", handleDocumentEscape);
    };
  }, [isOpen, onClose, restoreFocus]);

  useEffect(() => {
    if (!isOpen) return;
    const root = menuRef.current;
    if (!root) return;
    const items = Array.from(root.querySelectorAll<HTMLElement>('[role="menuitem"]:not([aria-disabled="true"]):not([disabled])'));
    const target = items[activeIndex];
    if (target) target.focus({ preventScroll: true });
  }, [activeIndex, isOpen]);

  if (!isOpen) return null;

  const style: CSSProperties = { top: y, left: x };

  return (
    <div
      ref={menuRef}
      className={className}
      style={style}
      role="menu"
      aria-label={ariaLabel}
      tabIndex={-1}
      onKeyDown={(event) => {
        const root = menuRef.current;
        const itemCount = root
          ? root.querySelectorAll('[role="menuitem"]:not([aria-disabled="true"]):not([disabled])').length
          : 0;

        handleContextMenuKeydown({
          key: event.key,
          itemCount,
          activeIndex,
          onActiveIndexChange: setActiveIndex,
          onClose,
          onRestoreFocus: restoreFocus,
          preventDefault: () => event.preventDefault(),
        });
      }}
    >
      {children}
    </div>
  );
}
