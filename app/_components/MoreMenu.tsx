"use client";

import type {
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactNode,
} from "react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AnchoredMenu from "./AnchoredMenu";
import useDismissableLayer from "./useDismissableLayer";
import { useTouchLike } from "@/lib/ui/isTouchLike";

type MoreMenuProps = {
  label: string;
  children: ReactNode;
  align?: "left" | "right";
  onOpenChange?: (open: boolean) => void;
  onTriggerClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  triggerClassName?: string;
  menuClassName?: string;
  contentClassName?: string;
  closeOnSelect?: boolean;
};

const MENU_ITEM_SELECTOR = [
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  "button",
  "a[href]",
].join(",");

const DOCUMENT_TABBABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "summary",
  "iframe",
  "audio[controls]",
  "video[controls]",
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function isElementHidden(element: HTMLElement) {
  if (element.hidden || element.closest('[hidden],[aria-hidden="true"],[inert]')) {
    return true;
  }

  const style = window.getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}

function isEnabledMenuItem(item: HTMLElement) {
  if (item.getAttribute("aria-disabled") === "true") return false;
  if (item.hasAttribute("disabled") || item.matches(":disabled")) return false;
  return !isElementHidden(item);
}

function getMenuItemCandidates(menu: HTMLElement) {
  const candidates = Array.from(
    menu.querySelectorAll<HTMLElement>(MENU_ITEM_SELECTOR),
  );

  return candidates.filter((candidate) => {
    const parentMenuItem = candidate.parentElement?.closest<HTMLElement>(
      '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]',
    );
    return !parentMenuItem || !menu.contains(parentMenuItem);
  });
}

function getEnabledMenuItems(menu: HTMLElement) {
  const candidates = getMenuItemCandidates(menu);
  candidates.forEach((item) => {
    if (!item.hasAttribute("role")) item.setAttribute("role", "menuitem");
    item.tabIndex = -1;
  });
  return candidates.filter(isEnabledMenuItem);
}

function focusMenuItem(items: HTMLElement[], index: number) {
  const item = items[index];
  if (!item) return;
  items.forEach((candidate) => {
    candidate.tabIndex = candidate === item ? 0 : -1;
  });
  item.focus();
}

function isDocumentTabbable(element: HTMLElement) {
  if (element.tabIndex < 0) return false;
  if (element.getAttribute("aria-disabled") === "true") return false;
  if (element.hasAttribute("disabled") || element.matches(":disabled")) {
    return false;
  }
  return !isElementHidden(element);
}

function getAdjacentFocusableFromTrigger(
  trigger: HTMLButtonElement,
  menu: HTMLElement | null,
  direction: 1 | -1,
) {
  const tabbable = Array.from(
    document.querySelectorAll<HTMLElement>(DOCUMENT_TABBABLE_SELECTOR),
  ).filter(
    (element) =>
      !menu?.contains(element) && isDocumentTabbable(element),
  );
  const triggerIndex = tabbable.indexOf(trigger);
  if (triggerIndex < 0) return trigger;

  const nextIndex = triggerIndex + direction;
  if (tabbable[nextIndex]) return tabbable[nextIndex];
  return direction === 1
    ? (tabbable[0] ?? trigger)
    : (tabbable[tabbable.length - 1] ?? trigger);
}

export default function MoreMenu({
  label,
  children,
  align = "right",
  onOpenChange,
  onTriggerClick,
  triggerClassName,
  menuClassName,
  contentClassName,
  closeOnSelect = false,
}: MoreMenuProps) {
  const menuInstanceId = useId();
  const menuDomId = `${menuInstanceId}-menu`;
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerAriaLabel = useMemo(() => label || "더보기", [label]);
  const { compact, touchLike } = useTouchLike();
  const isCompactUi = compact || touchLike;

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  const restoreTriggerFocus = useCallback(() => {
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  // A layout-phase listener is registered before useDismissableLayer's
  // passive listener so Escape has one owner and emits onOpenChange once.
  useLayoutEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const target = event.target;
      if (!(target instanceof Node) || !menuRef.current?.contains(target)) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      closeMenu();
      restoreTriggerFocus();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => document.removeEventListener("keydown", handleEscape, true);
  }, [closeMenu, isOpen, restoreTriggerFocus]);

  useDismissableLayer({
    isOpen,
    setIsOpen,
    layerRef: wrapperRef,
    anchorRef: triggerRef,
    boundaryRefs: [wrapperRef, menuRef],
    onDismiss: () => onOpenChange?.(false),
  });

  useLayoutEffect(() => {
    if (!isOpen || !menuRef.current) return;

    const menu = menuRef.current;
    menu.id = menuDomId;
    menu.setAttribute("aria-label", triggerAriaLabel);
    const focusFrame = window.requestAnimationFrame(() => {
      if (!menuRef.current) return;
      focusMenuItem(getEnabledMenuItems(menuRef.current), 0);
    });

    return () => window.cancelAnimationFrame(focusFrame);
  }, [isOpen, menuDomId, triggerAriaLabel]);

  useEffect(() => {
    const handleGlobalMenuOpen = (event: Event) => {
      const customEvent = event as CustomEvent<{ id?: string }>;
      if (customEvent.detail?.id === menuInstanceId) return;
      setIsOpen(false);
      onOpenChange?.(false);
    };
    window.addEventListener("gomdory:more-menu-open", handleGlobalMenuOpen as EventListener);
    return () => window.removeEventListener("gomdory:more-menu-open", handleGlobalMenuOpen as EventListener);
  }, [menuInstanceId, onOpenChange]);

  useEffect(() => {
    const handleGlobalMenuClose = () => {
      setIsOpen((current) => {
        if (current) setTimeout(() => triggerRef.current?.focus(), 0);
        return false;
      });
      onOpenChange?.(false);
    };
    window.addEventListener("gomdory:more-menu-close", handleGlobalMenuClose);
    return () => window.removeEventListener("gomdory:more-menu-close", handleGlobalMenuClose);
  }, [onOpenChange]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;

      closeMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
    };
  }, [closeMenu, isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        window.dispatchEvent(new CustomEvent("gomdory:more-menu-open", { detail: { id: menuInstanceId } }));
      }
      onOpenChange?.(next);
      return next;
    });
  };

  const handleCloseOnSelect = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!closeOnSelect) return;
    const target = event.target as HTMLElement | null;
    const item = target?.closest?.("button,a,[role=\"menuitem\"],[role=\"menuitemcheckbox\"],[role=\"menuitemradio\"]") as HTMLElement | null;
    if (!item || item.getAttribute("aria-disabled") === "true") return;
    if (item instanceof HTMLButtonElement && item.disabled) return;
    closeMenu();
  };

  const handleMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const menu = menuRef.current;
    if (!menu) return;

    if (event.key === "Tab") {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const target = getAdjacentFocusableFromTrigger(
        trigger,
        menu,
        event.shiftKey ? -1 : 1,
      );
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      window.requestAnimationFrame(() => {
        if (target.isConnected) target.focus();
        else triggerRef.current?.focus();
      });
      return;
    }

    if (
      event.key !== "ArrowDown" &&
      event.key !== "ArrowUp" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const items = getEnabledMenuItems(menu);
    if (items.length === 0) return;
    const activeElement = document.activeElement;
    const currentIndex = items.findIndex(
      (item) => item === activeElement || item.contains(activeElement),
    );
    let nextIndex = currentIndex;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    }
    if (event.key === "ArrowUp") {
      nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1;
    }

    event.preventDefault();
    event.stopPropagation();
    focusMenuItem(items, nextIndex);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={triggerAriaLabel}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-controls={isOpen ? menuDomId : undefined}
        data-dismiss-ignore="true"
        data-interactive="true"
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onTriggerClick?.(event);
          handleToggle();
        }}
        className={`flex cursor-pointer items-center justify-center rounded-md border border-[var(--theme-more-button-border,rgba(229,231,235,0.8))] bg-[var(--theme-more-button-bg,rgba(255,255,255,0.8))] text-[var(--theme-more-button-text,#374151)] shadow-sm transition hover:bg-[var(--theme-more-button-hover-bg,#ffffff)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus,rgba(199,210,254,1))] ${isCompactUi ? "h-10 w-10" : "h-9 w-9"} ${triggerClassName ?? ""}`}
      >
        <span className="text-lg leading-none">⋯</span>
      </button>
      <AnchoredMenu
        open={isOpen}
        anchorRef={triggerRef}
        menuRef={menuRef}
        align={align}
        role="menu"
        className={menuClassName ?? "w-48 rounded-xl border border-[var(--theme-menu-border,rgba(229,231,235,0.8))] bg-[var(--theme-menu-bg,rgba(255,255,255,0.95))] p-2 text-[var(--theme-menu-text,#111827)] shadow-[0_12px_30px_-20px_rgba(15,23,42,0.55)] backdrop-blur"}
      >
        <div
          className={contentClassName ?? "flex flex-col gap-1"}
          onClick={handleCloseOnSelect}
          onKeyDown={handleMenuKeyDown}
        >
          {children}
        </div>
      </AnchoredMenu>
    </div>
  );
}
