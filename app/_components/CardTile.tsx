import { forwardRef, type HTMLAttributes } from "react";

import {
  getCardColorToneClasses,
  normalizeCardColorTone,
} from "@/lib/ui/cardColors";

import { preventNativeDragProps } from "./preventNativeDrag";
import { cn, focusRingSoft, pressable, surface } from "./uiTokens";

type CardTileVariant = "default" | "dense" | "present";
type CardTileElement = "div" | "li" | "button" | "a";

type CardTileProps = {
  variant?: CardTileVariant;
  interactive?: boolean;
  selected?: boolean;
  subdued?: boolean;
  calm?: boolean;
  as?: CardTileElement;
  type?: "button" | "submit" | "reset";
  href?: string;
  target?: string;
  rel?: string;
  colorTone?: string | null;
} & HTMLAttributes<HTMLElement>;

const CardTile = forwardRef<HTMLElement, CardTileProps>(function CardTile(
  {
    variant = "default",
    interactive = false,
    selected = false,
    subdued = false,
    calm = false,
    as: Component = "div",
    colorTone,
    className,
    style,
    children,
    ...props
  },
  ref,
) {
  const padding =
    variant === "dense" ? "p-3" : variant === "present" ? "p-5 sm:p-6" : "p-4";
  const ringOffsetClass = variant === "present" ? "ring-offset-slate-900" : "ring-offset-white";
  const cardColorTone = normalizeCardColorTone(colorTone);
  const hasCustomCardColor = cardColorTone !== "default";
  const baseSurface = hasCustomCardColor
    ? getCardColorToneClasses(cardColorTone)
    : subdued
      ? surface.subtle
      : surface.card;
  const hoverStyles = interactive ? (calm ? pressable.quiet : pressable.raised) : "";
  const selectionStyles = selected
    ? `border-indigo-300 ring-2 ring-indigo-200 ring-offset-2 ${ringOffsetClass} shadow-md`
    : "";
  const focusWithin = interactive ? cn("focus-within:outline-none", focusRingSoft, ringOffsetClass) : "";
  const dragGuards = preventNativeDragProps();
  const mergedStyle = { WebkitUserDrag: "none" as const, ...style };

  // Guardrail: card body content must remain text-selectable for drag highlight/copy UX.
  // Do not replace with `select-none` on the root tile; constrain non-selectable behavior
  // to explicit drag handles/buttons only.
  return (
    <Component
      ref={ref as never}
      className={cn(
        "card-tile group relative flex select-text flex-col gap-3 rounded-[var(--dashboard-card-radius,1rem)] border",
        calm ? "transition-none motion-reduce:transition-none" : "transition",
        baseSurface,
        padding,
        hoverStyles,
        selectionStyles,
        focusWithin,
        ringOffsetClass,
        className,
      )}
      style={mergedStyle}
      data-card-color-tone={cardColorTone}
      {...dragGuards}
      {...props}
    >
      {children}
    </Component>
  );
});

export default CardTile;
