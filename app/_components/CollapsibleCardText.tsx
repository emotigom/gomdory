"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import LinkifiedText from "./LinkifiedText";

type CollapsibleCardTextProps = {
  text: string;
  className?: string;
  collapsedLines?: number;
  emptyFallback?: string;
  linkClassName?: string;
  compactLinks?: boolean;
};

export default function CollapsibleCardText({
  text,
  className,
  collapsedLines = 5,
  emptyFallback,
  linkClassName,
  compactLinks = true,
}: CollapsibleCardTextProps) {
  const normalizedText = text.trim();
  const displayText = normalizedText || emptyFallback || "";
  const paragraphRef = useRef<HTMLParagraphElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [collapsible, setCollapsible] = useState(false);
  const contentId = useId();

  useEffect(() => {
    setExpanded(false);
  }, [displayText]);

  useEffect(() => {
    const element = paragraphRef.current;
    if (!element || !displayText) {
      setCollapsible(false);
      return;
    }

    const checkOverflow = () => {
      setCollapsible(element.scrollHeight > element.clientHeight + 1);
    };

    checkOverflow();

    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(element);

    return () => {
      resizeObserver.disconnect();
    };
  }, [displayText, collapsedLines, expanded]);

  const clampStyle = useMemo(() => {
    if (expanded || !displayText) {
      return undefined;
    }

    return {
      display: "-webkit-box",
      WebkitLineClamp: String(collapsedLines),
      WebkitBoxOrient: "vertical" as const,
      overflow: "hidden",
    };
  }, [collapsedLines, displayText, expanded]);

  return (
    <div className="space-y-1.5">
      <p id={contentId} ref={paragraphRef} className={className} style={clampStyle}>
        <LinkifiedText text={displayText} linkClassName={linkClassName} compact={compactLinks} />
      </p>
      {collapsible ? (
        <div className="flex items-center">
          <button
            type="button"
            data-testid="card-read-more-button"
            className="inline-flex items-center rounded-full border border-[var(--theme-border-strong)] bg-[var(--theme-surface-muted)] px-2 py-1 text-xs font-semibold text-[var(--theme-text)] transition hover:bg-[var(--theme-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-card)]"
            onClick={(event) => {
              event.stopPropagation();
              setExpanded((prev) => !prev);
            }}
            aria-expanded={expanded}
            aria-controls={contentId}
          >
            {expanded ? "접기" : "더보기"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
