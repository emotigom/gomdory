"use client";

import { linkifyPlainText } from "@/lib/urlLinkify";
import { cn } from "./uiTokens";

type LinkifiedTextProps = {
  text: string;
  className?: string;
  linkClassName?: string;
  compact?: boolean;
};

const DEFAULT_LINK_CLASS =
  "font-semibold text-[var(--theme-accent)] underline underline-offset-2 decoration-2 break-words [overflow-wrap:anywhere] hover:text-[var(--theme-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-card)]";

const compactUrlLabel = (value: string) => {
  if (value.length <= 72) return value;
  return `${value.slice(0, 44)}…${value.slice(-20)}`;
};

function renderTextWithBreaks(text: string, keyPrefix: string) {
  return text.split("\n").flatMap((part, index, parts) => {
    const nodes = [<span key={`${keyPrefix}-text-${index}`}>{part}</span>];
    if (index < parts.length - 1) {
      nodes.push(<br key={`${keyPrefix}-br-${index}`} />);
    }
    return nodes;
  });
}

export default function LinkifiedText({ text, className, linkClassName, compact = false }: LinkifiedTextProps) {
  const segments = linkifyPlainText(text);

  return (
    <span className={cn("break-words [overflow-wrap:anywhere]", className)}>
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return renderTextWithBreaks(segment.text, `segment-${index}`);
        }

        const displayText = compact ? compactUrlLabel(segment.text) : segment.text;
        return (
          <a
            key={`segment-${index}`}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(DEFAULT_LINK_CLASS, linkClassName)}
            title={segment.text}
            data-linkified-url="true"
            onClick={(event) => event.stopPropagation()}
          >
            {displayText}
            <span className="sr-only">새 창에서 열기</span>
          </a>
        );
      })}
    </span>
  );
}
