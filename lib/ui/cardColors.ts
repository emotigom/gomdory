import {
  CARD_COLOR_TOKENS,
  isCardColorToken,
  type CardColorToken,
} from "@/lib/types/cards";

const CARD_COLOR_SURFACE_OVERRIDE_CLASSES =
  "[background-image:none!important] [--theme-text:#0f172a] [--theme-text-muted:#475569] [--theme-surface:rgba(255,255,255,0.88)] [--theme-surface-muted:rgba(248,250,252,0.82)] [--theme-panel-strong:rgba(255,255,255,0.72)] [--theme-border:rgba(100,116,139,0.34)] [--theme-accent:#0369a1] [--theme-accent-strong:#075985] [--theme-focus:#2563eb] [--theme-card:#ffffff]";

const withVisibleCardSurface = (classes: string) =>
  `${classes} ${CARD_COLOR_SURFACE_OVERRIDE_CLASSES}`;

export const CARD_COLOR_CLASS_MAP: Record<CardColorToken, string> = {
  default: "bg-white border-slate-200",
  gray: withVisibleCardSurface(
    "!bg-slate-100 !border-slate-300/70 dark:!bg-slate-100 dark:!border-slate-300/70",
  ),
  yellow: withVisibleCardSurface(
    "!bg-yellow-50 !border-yellow-300 dark:!bg-yellow-50 dark:!border-yellow-300",
  ),
  pink: withVisibleCardSurface(
    "!bg-pink-50 !border-pink-300 dark:!bg-pink-50 dark:!border-pink-300",
  ),
  green: withVisibleCardSurface(
    "!bg-emerald-50 !border-emerald-300 dark:!bg-emerald-50 dark:!border-emerald-300",
  ),
  purple: withVisibleCardSurface(
    "!bg-violet-50 !border-violet-300 dark:!bg-violet-50 dark:!border-violet-300",
  ),
  sky: withVisibleCardSurface(
    "!bg-sky-50 !border-sky-300 dark:!bg-sky-50 dark:!border-sky-300",
  ),
  orange: withVisibleCardSurface(
    "!bg-orange-50 !border-orange-300 dark:!bg-orange-50 dark:!border-orange-300",
  ),
};

export const CARD_COLOR_LABELS: Record<CardColorToken, string> = {
  default: "기본",
  gray: "회색",
  yellow: "연노랑",
  pink: "연분홍",
  green: "연초록",
  purple: "연보라",
  sky: "연하늘",
  orange: "연주황",
};

export const CARD_COLOR_SWATCH_CLASS_MAP: Record<CardColorToken, string> = {
  default: "bg-white",
  gray: "bg-slate-300",
  yellow: "bg-yellow-200",
  pink: "bg-pink-200",
  green: "bg-emerald-200",
  purple: "bg-violet-200",
  sky: "bg-sky-200",
  orange: "bg-orange-200",
};

export const CARD_COLOR_OPTIONS = CARD_COLOR_TOKENS.map((token) => ({
  token,
  label: CARD_COLOR_LABELS[token],
  className: CARD_COLOR_CLASS_MAP[token],
  swatchClass: CARD_COLOR_SWATCH_CLASS_MAP[token],
}));

export function normalizeCardColorTone(token?: string | null): CardColorToken {
  return token && isCardColorToken(token) ? token : "default";
}

export function getCardColorToneClasses(token?: string | null): string {
  return CARD_COLOR_CLASS_MAP[normalizeCardColorTone(token)];
}

export function getCardColorClass(token?: string | null): string {
  return getCardColorToneClasses(token);
}
