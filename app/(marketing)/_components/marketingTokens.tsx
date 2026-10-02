type ClassValue = string | number | false | null | undefined;

export type MarketingThemeId = "daybreak-studio" | "classic" | "nebula-command";

export type MarketingThemePreset = {
  background: string;
  backgroundRadial: string;
  surface: string;
  surfaceStrong: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  primary: string;
  primaryGlow: string;
  accent: string;
  warning: string;
  shadow: string;
  panelGradient: string;
  ctaGradient: string;
};

export const MARKETING_THEMES: Record<MarketingThemeId, MarketingThemePreset> = {
  "daybreak-studio": {
    background: "#f5f0e6",
    backgroundRadial: "linear-gradient(rgba(25,36,58,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(25,36,58,0.05) 1px, transparent 1px)",
    surface: "#f8f2e7",
    surfaceStrong: "#fffdf7",
    border: "#b9b3a7",
    borderStrong: "#19243a",
    text: "#19243a",
    textMuted: "#4d5868",
    primary: "#2d56d6",
    primaryGlow: "rgba(45,86,214,0.22)",
    accent: "#d84a2b",
    warning: "#b83f24",
    shadow: "5px 5px 0 rgba(25,36,58,0.14)",
    panelGradient: "linear-gradient(145deg,#fffdf7,#f7efe0)",
    ctaGradient: "linear-gradient(110deg,#2d56d6,#1f3fa8)",
  },
  classic: {
    background: "#fbf7ef",
    backgroundRadial: "radial-gradient(circle at 10% 10%, rgba(125,211,252,0.16), transparent 34%), radial-gradient(circle at 86% 5%, rgba(147,197,253,0.12), transparent 36%)",
    surface: "rgba(255,255,255,0.9)",
    surfaceStrong: "#ffffff",
    border: "#cdd4dc",
    borderStrong: "#9aa6b2",
    text: "#1a1f2b",
    textMuted: "#465060",
    primary: "#0f1a2e",
    primaryGlow: "rgba(56,189,248,0.35)",
    accent: "#0891b2",
    warning: "#d97706",
    shadow: "0 22px 120px -108px rgba(8,47,73,0.56)",
    panelGradient: "linear-gradient(164deg,rgba(15,24,39,0.93),rgba(21,33,50,0.88) 42%,rgba(242,236,225,0.9) 160%)",
    ctaGradient: "linear-gradient(110deg,#0f1a2e,#0d3855)",
  },
  "nebula-command": {
    background: "#070b14",
    backgroundRadial: "radial-gradient(circle at 12% 8%, rgba(34,211,238,0.18), transparent 34%), radial-gradient(circle at 86% 12%, rgba(99,102,241,0.2), transparent 38%), radial-gradient(circle at 50% 90%, rgba(15,118,110,0.18), transparent 42%)",
    surface: "rgba(15,26,46,0.62)",
    surfaceStrong: "rgba(12,20,36,0.92)",
    border: "rgba(148,163,184,0.32)",
    borderStrong: "rgba(34,211,238,0.55)",
    text: "#e5edf8",
    textMuted: "#9fb0c8",
    primary: "#22d3ee",
    primaryGlow: "rgba(34,211,238,0.42)",
    accent: "#5eead4",
    warning: "#f59e0b",
    shadow: "0 34px 130px -90px rgba(6,12,26,0.88)",
    panelGradient: "linear-gradient(152deg,rgba(10,18,33,0.98),rgba(18,31,54,0.88) 45%,rgba(8,14,26,0.96) 100%)",
    ctaGradient: "linear-gradient(102deg,#0d213d,#134e74)",
  },
};

export const DEFAULT_MARKETING_THEME: MarketingThemeId = "daybreak-studio";

export function resolveMarketingTheme(themeParam?: string | null): MarketingThemeId {
  if (themeParam === "daybreak-studio" || themeParam === "classic" || themeParam === "nebula-command") return themeParam;
  return DEFAULT_MARKETING_THEME;
}

export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(" ");
}

export const containerClass = "mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-12";
export const sectionClass = "space-y-14 md:space-y-20";

export const hairlineBorderClass = "border border-[var(--marketing-border)]";

export const shadowSoft = "shadow-[var(--marketing-shadow)]";
export const pressableClass = "transition duration-200 ease-out will-change-transform hover:-translate-y-0.5 active:translate-y-0 motion-reduce:transform-none";
export const cardClass = cn(hairlineBorderClass, "relative overflow-hidden rounded-[10px] bg-[var(--marketing-surface-strong)]", shadowSoft);
export const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marketing-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--marketing-bg)]";
export const premiumFocusRingClass = focusRingClass;
export const commandButtonClass = "relative isolate overflow-hidden transition duration-300";


export const inProductCommandSurfaceClass = "relative overflow-hidden border border-[var(--marketing-border)] bg-[var(--marketing-surface-strong)] shadow-[var(--marketing-shadow)]";
export const chipClass = "inline-flex items-center gap-2 border border-[var(--marketing-border)] bg-[var(--marketing-surface)] px-3 py-1 text-[13px] font-semibold text-[var(--marketing-text)]";
export const activeChipClass = "border-[var(--marketing-border-strong)] bg-[var(--marketing-surface-strong)] text-[var(--marketing-text)]";
export const commandSurfaceClass = inProductCommandSurfaceClass;
export const commandDividerClass = "relative before:absolute before:inset-x-0 before:-top-px before:h-px before:bg-[var(--marketing-primary-glow)]";
export function commandBridgeBg(){ return null; }
export function subtleBgLayers(opts?: { className?: string }){
  void opts;
  return null;
}
export function subtleSpotlightClass(position?: "top" | "center" | "bottom"){
  void position;
  return "";
}
