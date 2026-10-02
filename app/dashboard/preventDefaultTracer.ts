"use client";

declare global {
  interface Window {
    __pdTracerInstalled?: boolean;
    __pdTracerLogger?: (message: string) => void;
  }
}

const TRACED_EVENTS = new Set(["pointerdown", "mousedown", "click"]);

function describeElement(element: Element | null): string {
  if (!element) return "none";
  const tag = element.tagName.toLowerCase();
  const id = element.id ? `#${element.id}` : "";
  const className = element.classList?.value ? `.${Array.from(element.classList).join(".")}` : "";
  const name = element.getAttribute("name");
  const dataTestId = element.getAttribute("data-testid");
  const identifier = name ? `[name="${name}"]` : dataTestId ? `[data-testid="${dataTestId}"]` : "";
  return `<${tag}${id}${className}${identifier}>`;
}

function formatStack(errorStack?: string | null): string {
  if (!errorStack) return "";
  return errorStack
    .split("\n")
    .slice(2, 12)
    .map((line) => line.trim())
    .join("\n");
}

function logEvent(
  method: "preventDefault" | "stopPropagation",
  event: Event,
  defaultPreventedBefore: boolean,
) {
  if (!TRACED_EVENTS.has(event.type)) return;

  const target = event.target instanceof Element ? event.target : null;
  const closestAction =
    target?.closest("a[href],button,[role='button'],[data-interactive='true']") ?? null;
  const stack = formatStack(new Error().stack);
  const logger = window.__pdTracerLogger ?? console.log;

  logger(
    `[pd-tracer] ${method} type=${event.type} defaultPrevented ${defaultPreventedBefore} -> ${event.defaultPrevented} target=${describeElement(target)} closestAction=${describeElement(closestAction)}\n${stack}`,
  );
}

export function installPreventDefaultTracer(options?: { force?: boolean; onLog?: (line: string) => void }) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  const shouldForce = options?.force === true;
  if (!shouldForce && params.get("debugClicks") !== "1") {
    return;
  }

  window.__pdTracerLogger = options?.onLog ?? console.log;

  if (window.__pdTracerInstalled) return;

  const originalPreventDefault = Event.prototype.preventDefault;
  const originalStopPropagation = Event.prototype.stopPropagation;

  Event.prototype.preventDefault = function patchedPreventDefault(this: Event, ...args: unknown[]) {
    const defaultPreventedBefore = this.defaultPrevented;
    const result = originalPreventDefault.apply(this, args as never);
    logEvent("preventDefault", this, defaultPreventedBefore);
    return result;
  };

  Event.prototype.stopPropagation = function patchedStopPropagation(
    this: Event,
    ...args: unknown[]
  ) {
    logEvent("stopPropagation", this, this.defaultPrevented);
    return originalStopPropagation.apply(this, args as never);
  };

  window.__pdTracerInstalled = true;
}
