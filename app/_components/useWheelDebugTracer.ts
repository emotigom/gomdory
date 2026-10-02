"use client";

import { useEffect } from "react";

type WheelDebugTracerOptions = {
  enabled: boolean;
  panelOpen: boolean;
  panelName: string;
};

export function shouldEnableWheelDebugTracer(): boolean {
  if (process.env.NODE_ENV === "production") return false;
  if (typeof window === "undefined") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("wheelDebug") === "1";
}

function isElement(target: EventTarget | null): target is Element {
  return target instanceof Element;
}

function summarizeTarget(target: EventTarget | null): string {
  if (!isElement(target)) return "unknown";
  const className = target.className && typeof target.className === "string"
    ? `.${target.className.trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".")}`
    : "";
  const dataScroll = target.getAttribute("data-scroll");
  return `${target.tagName.toLowerCase()}${className}${dataScroll ? `[data-scroll=${dataScroll}]` : ""}`;
}

function summarizePath(path: EventTarget[]): string {
  return path
    .slice(0, 6)
    .map((entry) => summarizeTarget(entry))
    .join(" > ");
}

function summarizeTopElementsFromPoint(x: number, y: number): string[] {
  return document.elementsFromPoint(x, y).slice(0, 5).map((element) => summarizeTarget(element));
}

function resolvePhaseName(phase: number): "capture" | "bubble" | "target" | "unknown" {
  if (phase === Event.CAPTURING_PHASE) return "capture";
  if (phase === Event.BUBBLING_PHASE) return "bubble";
  if (phase === Event.AT_TARGET) return "target";
  return "unknown";
}

function isWheelStealerCandidate(element: Element): boolean {
  const style = window.getComputedStyle(element);
  if (style.pointerEvents !== "auto") return false;
  if (style.position !== "fixed" && style.position !== "absolute") return false;

  const rect = element.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  if (viewportWidth <= 0 || viewportHeight <= 0) return false;

  const coversEnoughViewport = rect.width >= viewportWidth * 0.7 && rect.height >= viewportHeight * 0.7;
  return coversEnoughViewport;
}

function summarizeElementForDebug(element: Element): Record<string, unknown> {
  const style = window.getComputedStyle(element);
  const datasetEntries = Object.entries((element as HTMLElement).dataset ?? {});
  const parentChain: string[] = [];
  let current: Element | null = element.parentElement;

  for (let depth = 0; depth < 3 && current; depth += 1) {
    parentChain.push(summarizeTarget(current));
    current = current.parentElement;
  }

  return {
    target: summarizeTarget(element),
    className: (element as HTMLElement).className,
    role: element.getAttribute("role"),
    dataAttributes: Object.fromEntries(datasetEntries),
    position: style.position,
    pointerEvents: style.pointerEvents,
    zIndex: style.zIndex,
    rect: element.getBoundingClientRect().toJSON(),
    parentChain,
  };
}

function flashDebugOutline(element: Element) {
  const htmlElement = element as HTMLElement;
  const previousOutline = htmlElement.style.outline;
  const previousOffset = htmlElement.style.outlineOffset;
  htmlElement.style.outline = "2px solid red";
  htmlElement.style.outlineOffset = "-2px";

  requestAnimationFrame(() => {
    htmlElement.style.outline = previousOutline;
    htmlElement.style.outlineOffset = previousOffset;
  });
}

export function useWheelDebugTracer({ enabled, panelOpen, panelName }: WheelDebugTracerOptions) {
  useEffect(() => {
    if (!enabled || process.env.NODE_ENV === "production") return;

    const preventedAtByEvent = new WeakMap<WheelEvent, "none" | "capture" | "bubble-or-target">();

    const logWheel = (event: WheelEvent, listenerPhase: "capture" | "bubble") => {
      const path = typeof event.composedPath === "function" ? event.composedPath() : [];
      const prev = preventedAtByEvent.get(event) ?? "none";
      const preventedAtPhase = listenerPhase === "capture"
        ? (event.defaultPrevented ? "capture" : "none")
        : prev === "capture"
          ? "capture"
          : event.defaultPrevented
            ? "bubble-or-target"
            : "none";

      preventedAtByEvent.set(event, preventedAtPhase);
      console.log("[wheel-debug] wheel-trace", {
        phase: `${listenerPhase}/${resolvePhaseName(event.eventPhase)}`,
        panel: `${panelName}:${panelOpen ? "open" : "closed"}`,
        defaultPrevented: event.defaultPrevented,
        preventedAtPhase,
        cancelable: event.cancelable,
        deltaY: event.deltaY,
        deltaX: event.deltaX,
        timestamp: Date.now(),
        target: summarizeTarget(event.target),
        path: summarizePath(path),
        topElementsFromPoint: summarizeTopElementsFromPoint(event.clientX, event.clientY),
      });

      if (listenerPhase !== "capture") return;
      const scanTargets = document.elementsFromPoint(event.clientX, event.clientY);
      const candidates = scanTargets.filter(isWheelStealerCandidate);
      if (candidates.length === 0) return;

      candidates.forEach((element) => {
        flashDebugOutline(element);
        console.log("[wheel-debug] wheel-stealer-candidate", summarizeElementForDebug(element));
      });
    };

    const onCapture = (event: WheelEvent) => logWheel(event, "capture");
    const onBubble = (event: WheelEvent) => logWheel(event, "bubble");
    const onMouseMove = (event: MouseEvent) => {
      const targets = summarizeTopElementsFromPoint(event.clientX, event.clientY);
      if (targets.length === 0) return;
      console.log("[wheel-debug] elements-from-point", {
        x: event.clientX,
        y: event.clientY,
        topElements: targets,
      });
    };

    document.addEventListener("wheel", onCapture, { capture: true, passive: false });
    document.addEventListener("wheel", onBubble, { passive: true });
    document.addEventListener("mousemove", onMouseMove, { passive: true });

    return () => {
      document.removeEventListener("wheel", onCapture, { capture: true });
      document.removeEventListener("wheel", onBubble);
      document.removeEventListener("mousemove", onMouseMove);
    };
  }, [enabled, panelName, panelOpen]);
}
