"use client";

import { useCallback, useEffect, useMemo, useRef, type RefObject } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import { shouldIgnoreHotkeyEvent } from "@/lib/keyboard";

import { interactiveSelector } from "./interaction";

let debugClickLoggerCount = 0;
export const DISMISSABLE_LAYER_ACTIVATION_MS = 300;

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest(interactiveSelector));
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

const logDebugEvent = (eventName: string, event: MouseEvent | PointerEvent) => {
  const target = event.target as Element | null;
  const tagName = target?.tagName?.toLowerCase() ?? "unknown";
  const className = target
    ? typeof target.className === "string"
      ? target.className
      : Array.from(target.classList ?? []).join(" ")
    : "";
  const interactive = isInteractiveTarget(target);
  const closestAnchor = target?.closest("a[href]") ?? null;
  const href =
    closestAnchor && closestAnchor instanceof HTMLAnchorElement
      ? closestAnchor.getAttribute("href") ?? "none"
      : "none";
  console.log(
    `[debugClicks] ${eventName} capture defaultPrevented=${event.defaultPrevented} target=<${tagName}> class="${className}" interactive=${interactive} closestHref=${href}`,
  );
};

const handleDocumentDebugPointerDown = (event: PointerEvent) => {
  logDebugEvent("pointerdown", event);
};

const handleDocumentDebugClick = (event: MouseEvent) => {
  logDebugEvent("click", event);
};

type DismissableElement = {
  contains?: (node: Element | null) => boolean;
  getAttribute?: (name: string) => string | null;
  closest?: (selector: string) => Element | null;
};

function isDismissIgnoreElement(element: DismissableElement | null): boolean {
  const attr = element?.getAttribute?.("data-dismiss-ignore");
  if (attr === "true") {
    return true;
  }
  return Boolean(element?.closest?.('[data-dismiss-ignore="true"]'));
}

function isDismissableElement(value: unknown): value is Element & DismissableElement {
  if (!value || typeof value !== "object") return false;
  return (
    typeof (value as DismissableElement).contains === "function" ||
    typeof (value as DismissableElement).closest === "function" ||
    typeof (value as DismissableElement).getAttribute === "function"
  );
}

export function shouldDismissLayerPointerDown(
  event: Pick<PointerEvent, "composedPath" | "target">,
  {
    openedAt,
    currentTime,
    boundaryElements,
    anchorElement,
    ignoreElements = [],
  }: {
    openedAt: number | null;
    currentTime?: number;
    boundaryElements: Array<DismissableElement | null>;
    anchorElement?: DismissableElement | null;
    ignoreElements?: Array<DismissableElement | null>;
  },
) {
  const now = currentTime ?? performance.now();
  if (openedAt != null && now - openedAt < DISMISSABLE_LAYER_ACTIVATION_MS) {
    return false;
  }

  const composedPath = typeof event.composedPath === "function" ? event.composedPath() : [];
  const composedElements = composedPath.filter(isDismissableElement);
  const targetElement = isDismissableElement(event.target)
    ? event.target
    : composedElements[0] ?? null;

  if (
    composedElements.some(isDismissIgnoreElement) ||
    isDismissIgnoreElement(targetElement as unknown as DismissableElement | null)
  ) {
    return false;
  }

  const candidateRefs =
    boundaryElements.length > 0 ? [...boundaryElements] : [];
  const candidates = new Set<DismissableElement>();

  [...candidateRefs, anchorElement, ...ignoreElements].forEach((element) => {
    if (element) {
      candidates.add(element);
    }
  });

  const candidateList = Array.from(candidates);
  const hasComposedPathHit =
    composedElements.length > 0 &&
    composedElements.some((element) =>
      candidateList.some(
        (node) =>
          node === element ||
          node.contains?.(element as Element | null) ||
          element.contains?.(node as Element | null),
      ),
    );

  const hasDirectHit =
    !hasComposedPathHit &&
    targetElement != null &&
    candidateList.some(
      (node) =>
        node === targetElement ||
        node.contains?.(targetElement as Element | null) ||
        targetElement.contains?.(node as Element | null),
    );

  return !(hasComposedPathHit || hasDirectHit);
}

export function shouldDismissOnKeyDown(event: { key?: string }) {
  return event.key === "Escape";
}

type UseDismissableLayerOptions = {
  isOpen: boolean;
  setIsOpen: (next: boolean) => void;
  layerRef?: RefObject<HTMLElement | null>;
  anchorRef?: RefObject<HTMLElement | null>;
  ignoreRefs?: Array<RefObject<HTMLElement | null>>;
  boundaryRefs?: Array<RefObject<HTMLElement | null>>;
  onDismiss?: () => void;
};

export default function useDismissableLayer({
  isOpen,
  setIsOpen,
  layerRef: providedLayerRef,
  anchorRef: providedAnchorRef,
  ignoreRefs = [],
  boundaryRefs = [],
  onDismiss,
}: UseDismissableLayerOptions) {
  // UI Interaction Contract: always close layers via capture-stage pointerdown + ESC.
  // Capture is intentional so outside clicks are observed even when bubbles are stopped by nested menus/drag handles.
  const fallbackLayerRef = useRef<HTMLElement | null>(null);
  const fallbackAnchorRef = useRef<HTMLElement | null>(null);
  const layerRef = providedLayerRef ?? fallbackLayerRef;
  const anchorRef = providedAnchorRef ?? fallbackAnchorRef;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeSignature = useMemo(
    () => `${pathname ?? ""}?${searchParams?.toString() ?? ""}`,
    [pathname, searchParams],
  );
  const debugClicksEnabled = useMemo(
    () => searchParams?.get("debugClicks") === "1",
    [searchParams],
  );
  const routeSignatureRef = useRef(routeSignature);
  const openedAtRef = useRef<number | null>(null);

  useEffect(() => {
    openedAtRef.current = isOpen ? performance.now() : null;
  }, [isOpen]);

  const dismiss = useCallback(() => {
    // setIsOpen must stay boolean-only to avoid functional updates mutating the signature.
    setIsOpen(false);
    onDismiss?.();
  }, [onDismiss, setIsOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const openedAt = openedAtRef.current;
      const shouldDismiss = shouldDismissLayerPointerDown(event, {
        openedAt,
        boundaryElements:
          boundaryRefs.length > 0
            ? [...boundaryRefs.map((ref) => ref?.current), layerRef.current]
            : [layerRef.current],
        anchorElement: anchorRef.current,
        ignoreElements: ignoreRefs.map((ref) => ref?.current),
      });

      if (shouldDismiss) {
        dismiss();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (shouldIgnoreHotkeyEvent(event)) return;
      if (shouldDismissOnKeyDown(event)) {
        if (isEditableTarget(event.target) && layerRef.current?.contains(event.target as Node)) {
          return;
        }
        dismiss();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        dismiss();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [anchorRef, boundaryRefs, dismiss, ignoreRefs, isOpen, layerRef]);

  useEffect(() => {
    if (!isOpen) {
      routeSignatureRef.current = routeSignature;
      return;
    }

    if (routeSignatureRef.current !== routeSignature) {
      routeSignatureRef.current = routeSignature;
      dismiss();
      return;
    }

    routeSignatureRef.current = routeSignature;
  }, [dismiss, isOpen, routeSignature]);

  useEffect(() => {
    if (!debugClicksEnabled) {
      return;
    }
    debugClickLoggerCount += 1;
    if (debugClickLoggerCount === 1) {
      document.addEventListener("pointerdown", handleDocumentDebugPointerDown, true);
      document.addEventListener("click", handleDocumentDebugClick, true);
    }

    return () => {
      debugClickLoggerCount = Math.max(debugClickLoggerCount - 1, 0);
      if (debugClickLoggerCount === 0) {
        document.removeEventListener("pointerdown", handleDocumentDebugPointerDown, true);
        document.removeEventListener("click", handleDocumentDebugClick, true);
      }
    };
  }, [debugClicksEnabled]);

  return { layerRef, anchorRef, dismiss };
}
