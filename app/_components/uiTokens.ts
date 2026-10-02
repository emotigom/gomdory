type ClassValue = string | number | false | null | undefined;

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg)]";
export const focusRingPremium = focusRing;
export const focusRingSoft =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-focus)]";
export const focusRingOnDark =
  "focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20 focus-visible:outline-none";
export const hairlineBorderClass = "border border-[var(--theme-border)]";

const sharedShadow = "shadow-[var(--theme-shadow)]";
const sharedPressable = "transition duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none";
const sharedCommandSurface =
  "relative overflow-hidden border border-[var(--theme-border)] bg-[var(--theme-card)] text-[var(--theme-text)] shadow-[var(--theme-shadow)]";
const sharedChip =
  "inline-flex items-center gap-2 border border-[var(--theme-border)] bg-[var(--theme-surface-muted)] px-3 py-1 text-[13px] font-semibold text-[var(--theme-text)]";

export const surface = {
  card: cn(
    "rounded-[var(--dashboard-card-radius,1rem)] bg-[var(--theme-card)] text-[var(--theme-text)]",
    hairlineBorderClass,
    sharedShadow,
    "shadow-[var(--dashboard-card-shadow,0_18px_120px_-90px_rgba(15,23,42,0.45))]",
  ),
  subtle: cn(
    "rounded-[var(--dashboard-card-radius,1rem)] bg-[var(--theme-surface-muted)] text-[var(--theme-text)]",
    hairlineBorderClass,
    "shadow-[var(--dashboard-card-shadow-subtle,0_12px_80px_-72px_rgba(15,23,42,0.32))]",
  ),
  overlay: cn(
    "rounded-3xl bg-[var(--theme-panel-strong)] backdrop-blur",
    hairlineBorderClass,
    "shadow-[0_32px_160px_-110px_rgba(15,23,42,0.6)]",
  ),
  glass: cn(
    "rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-panel)] backdrop-blur shadow-[var(--theme-shadow)]",
  ),
  activation: cn("rounded-2xl", sharedCommandSurface),
  command: cn("rounded-3xl", sharedCommandSurface),
  darkPanel:
    "rounded-2xl border border-white/15 bg-white/5 backdrop-blur shadow-[0_24px_120px_-90px_rgba(0,0,0,0.7)]",
};

export const pressable = {
  raised: cn(
    sharedPressable,
    "focus-visible:outline-none",
    focusRingSoft,
    "disabled:cursor-not-allowed disabled:opacity-60",
  ),
  quiet: cn(
    "transition-colors",
    "focus-visible:outline-none",
    focusRingSoft,
    "disabled:cursor-not-allowed disabled:opacity-60",
  ),
};

export const pill = {
  chip: cn(sharedChip, "shadow-[0_12px_60px_-44px_rgba(15,23,42,0.35)]"),
  badge:
    "inline-flex items-center rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white",
};

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";
type ButtonTone = "indigo" | "slate" | "emerald" | "sky" | "neutral" | "rose";

const buttonSizeMap: Record<ButtonSize, string> = {
  sm: "text-xs min-h-[40px] px-3",
  md: "text-sm min-h-[48px] px-4",
  lg: "text-base min-h-[52px] px-5",
};

const primaryToneMap: Record<ButtonTone, string> = {
  indigo:
    "bg-[var(--theme-accent)] text-[var(--theme-accent-text)] shadow-[0_14px_60px_-40px_rgba(49,87,213,0.7)] hover:bg-[var(--theme-accent-strong)] active:bg-[var(--theme-accent-strong)]",
  slate:
    "bg-slate-900 text-white shadow-[0_14px_60px_-40px_rgba(15,23,42,0.65)] hover:bg-slate-800 active:bg-slate-900",
  emerald:
    "bg-emerald-600 text-white shadow-[0_14px_60px_-40px_rgba(5,150,105,0.55)] hover:bg-emerald-700 active:bg-emerald-800",
  sky:
    "bg-sky-600 text-white shadow-[0_14px_60px_-40px_rgba(2,132,199,0.6)] hover:bg-sky-700 active:bg-sky-800",
  neutral:
    "bg-white text-slate-900 shadow-[0_14px_60px_-40px_rgba(15,23,42,0.35)] hover:bg-slate-50",
  rose:
    "bg-rose-600 text-white shadow-[0_14px_60px_-40px_rgba(225,29,72,0.6)] hover:bg-rose-700 active:bg-rose-800",
};

export function buttonTone(
  variant: ButtonVariant,
  options: {
    size?: ButtonSize;
    fullWidth?: boolean;
    tone?: ButtonTone;
    muted?: boolean;
  } = {},
) {
  const sizeClass = buttonSizeMap[options.size ?? "md"];
  const tone = options.tone ?? "indigo";
  const base = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
    "focus-visible:outline-none",
    focusRingSoft,
    options.fullWidth ? "w-full" : null,
    "disabled:cursor-not-allowed disabled:opacity-60",
    sizeClass,
  );

  if (variant === "primary") {
    return cn(base, primaryToneMap[tone]);
  }

  if (variant === "secondary") {
    return cn(
      base,
      hairlineBorderClass,
      options.muted ? "bg-[var(--theme-surface-muted)] text-[var(--theme-text)]" : "bg-[var(--theme-card)] text-[var(--theme-text)]",
      "hover:bg-[var(--theme-surface-muted)]",
    );
  }

  return cn(
    base,
    "text-[var(--theme-text-muted)] hover:bg-[var(--theme-surface-muted)] hover:text-[var(--theme-text)] active:bg-[var(--theme-surface-2)]",
    options.muted ? "border border-[var(--theme-border)]" : null,
  );
}

type DarkVariant = "primary" | "subtle" | "ghost";

export function onDarkButton(
  variant: DarkVariant,
  options: { size?: ButtonSize } = {},
) {
  const sizeClass = buttonSizeMap[options.size ?? "md"];
  const base = cn(
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition",
    "focus-visible:outline-none",
    focusRingOnDark,
    "disabled:cursor-not-allowed disabled:opacity-60",
    sizeClass,
  );

  if (variant === "primary") {
    return cn(base, "bg-white text-slate-900 shadow-[0_14px_60px_-36px_rgba(0,0,0,0.65)] hover:bg-slate-100");
  }

  if (variant === "subtle") {
    return cn(base, "border border-white/25 bg-white/12 text-white hover:border-white/45");
  }

  return cn(base, "text-white hover:bg-white/10");
}

export const tvText = {
  kicker: "text-[12px] font-semibold text-[var(--theme-text-muted)]",
  heading: "text-3xl font-semibold leading-tight tracking-tight text-[var(--theme-text)]",
  body: "text-base leading-7 text-[var(--theme-text-muted)]",
  caption: "text-xs font-medium text-[var(--theme-text-muted)]",
  tvHeading: "text-3xl font-semibold leading-tight text-white",
  tvBody: "text-lg leading-8 text-slate-100",
};
