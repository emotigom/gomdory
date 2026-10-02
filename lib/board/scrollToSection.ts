const escapeCssIdentifier = (value: string) => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type ScrollToSectionOptions = {
  behavior?: ScrollBehavior;
  align?: "start" | "center" | "end" | "nearest";
  offsetTop?: number;
};

export function buildSectionSelector(sectionId: string) {
  return `[data-card-section-id="${escapeCssIdentifier(sectionId)}"]`;
}

export function computeSectionScrollTop(input: {
  containerTop: number;
  containerHeight: number;
  currentScrollTop: number;
  targetTop: number;
  targetHeight: number;
  align: "start" | "center" | "end" | "nearest";
  offsetTop: number;
  maxScrollTop: number;
}): number {
  const targetTopWithinContainer = input.currentScrollTop + (input.targetTop - input.containerTop) - input.offsetTop;
  const targetBottomWithinContainer = targetTopWithinContainer + input.targetHeight;
  const viewportTop = input.currentScrollTop;
  const viewportBottom = viewportTop + input.containerHeight;

  let nextTop = viewportTop;
  if (input.align === "center") {
    nextTop = targetTopWithinContainer - (input.containerHeight - input.targetHeight) / 2;
  } else if (input.align === "end") {
    nextTop = targetBottomWithinContainer - input.containerHeight;
  } else if (input.align === "start") {
    nextTop = targetTopWithinContainer;
  } else if (targetTopWithinContainer < viewportTop) {
    nextTop = targetTopWithinContainer;
  } else if (targetBottomWithinContainer > viewportBottom) {
    nextTop = targetBottomWithinContainer - input.containerHeight;
  }

  return clamp(nextTop, 0, Math.max(input.maxScrollTop, 0));
}

export function scrollToSection(sectionId: string, options: ScrollToSectionOptions = {}) {
  if (typeof document === "undefined" || !sectionId) {
    return { ok: false } as const;
  }

  const section = document.querySelector<HTMLElement>(buildSectionSelector(sectionId));
  if (!section) {
    return { ok: false } as const;
  }

  const container = section.closest<HTMLElement>("[data-card-list-scroll-container]");
  const behavior = options.behavior ?? "smooth";
  const align = options.align ?? "start";
  const offsetTop = options.offsetTop ?? 0;

  if (container) {
    const containerRect = container.getBoundingClientRect();
    const targetRect = section.getBoundingClientRect();
    const nextTop = computeSectionScrollTop({
      containerTop: containerRect.top,
      containerHeight: container.clientHeight,
      currentScrollTop: container.scrollTop,
      targetTop: targetRect.top,
      targetHeight: targetRect.height,
      align,
      offsetTop,
      maxScrollTop: container.scrollHeight - container.clientHeight,
    });

    container.scrollTo({ top: nextTop, behavior });
  } else {
    section.scrollIntoView({ behavior, block: align === "nearest" ? "nearest" : align, inline: "nearest" });
  }

  return { ok: true, element: section } as const;
}
