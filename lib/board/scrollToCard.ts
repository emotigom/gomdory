const DEFAULT_HIGHLIGHT_CLASS = "ring-2 ring-amber-200";

export type ScrollToCardOptions = {
  behavior?: ScrollBehavior;
  block?: "start" | "center" | "end" | "nearest";
  inline?: "start" | "center" | "end" | "nearest";
  highlightClassName?: string;
  highlightDurationMs?: number;
  focus?: boolean;
};

export function resolveCardAnchor(cardAnchor: string): string {
  const normalized = cardAnchor.trim();
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("#")) {
    return decodeURIComponent(normalized.slice(1));
  }

  try {
    const parsed = new URL(normalized, "https://gom.local");
    const cardParam = parsed.searchParams.get("card");
    if (cardParam) {
      return cardParam;
    }
    if (parsed.hash.length > 1) {
      return decodeURIComponent(parsed.hash.slice(1));
    }
  } catch {
    // noop: raw card id input is handled below.
  }

  return normalized;
}

const escapeCssIdentifier = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

export function buildCardSelector(cardId: string) {
  const resolvedId = resolveCardAnchor(cardId);
  if (!resolvedId) {
    return "";
  }
  const escapedId = escapeCssIdentifier(resolvedId);
  return `[data-card-id="${escapedId}"],#${escapedId}`;
}

function getNearestScrollContainer(element: HTMLElement): HTMLElement | null {
  let current = element.parentElement;
  while (current) {
    const style = window.getComputedStyle(current);
    const overflowY = style.overflowY;
    const overflowX = style.overflowX;
    const isScrollableY =
      (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") &&
      current.scrollHeight > current.clientHeight;
    const isScrollableX =
      (overflowX === "auto" || overflowX === "scroll" || overflowX === "overlay") &&
      current.scrollWidth > current.clientWidth;

    if (isScrollableY || isScrollableX) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

function scrollInsideContainer(
  container: HTMLElement,
  target: HTMLElement,
  options: Required<Pick<ScrollToCardOptions, "behavior" | "block" | "inline">>,
) {
  const containerRect = container.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const next = { left: container.scrollLeft, top: container.scrollTop };

  if (options.block === "center") {
    next.top += targetRect.top - containerRect.top - (container.clientHeight - targetRect.height) / 2;
  } else if (options.block === "start") {
    next.top += targetRect.top - containerRect.top;
  } else if (options.block === "end") {
    next.top += targetRect.bottom - containerRect.bottom;
  } else if (targetRect.top < containerRect.top) {
    next.top += targetRect.top - containerRect.top;
  } else if (targetRect.bottom > containerRect.bottom) {
    next.top += targetRect.bottom - containerRect.bottom;
  }

  if (options.inline === "center") {
    next.left += targetRect.left - containerRect.left - (container.clientWidth - targetRect.width) / 2;
  } else if (options.inline === "start") {
    next.left += targetRect.left - containerRect.left;
  } else if (options.inline === "end") {
    next.left += targetRect.right - containerRect.right;
  } else if (targetRect.left < containerRect.left) {
    next.left += targetRect.left - containerRect.left;
  } else if (targetRect.right > containerRect.right) {
    next.left += targetRect.right - containerRect.right;
  }

  container.scrollTo({ top: next.top, left: next.left, behavior: options.behavior });
}

export function scrollToCard(cardId: string, options: ScrollToCardOptions = {}) {
  if (typeof document === "undefined" || !cardId) {
    return { ok: false } as const;
  }

  const selector = buildCardSelector(cardId);
  if (!selector) {
    return { ok: false } as const;
  }

  const target = document.querySelector<HTMLElement>(selector);
  if (!target) {
    return { ok: false } as const;
  }

  const behavior = options.behavior ?? "smooth";
  const block = options.block ?? "nearest";
  const inline = options.inline ?? "nearest";
  const container = getNearestScrollContainer(target);

  if (container) {
    scrollInsideContainer(container, target, { behavior, block, inline });
  } else {
    target.scrollIntoView({ behavior, block, inline });
  }

  const highlightClass = options.highlightClassName ?? DEFAULT_HIGHLIGHT_CLASS;
  const classes = highlightClass.split(/\s+/).filter(Boolean);
  if (classes.length > 0) {
    target.classList.add(...classes);
    window.setTimeout(() => {
      target.classList.remove(...classes);
    }, options.highlightDurationMs ?? 2000);
  }

  if (options.focus ?? true) {
    if (!target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
  }

  return { ok: true, element: target } as const;
}
