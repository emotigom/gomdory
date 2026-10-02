export const editorialPalette = {
  ivory: "bg-[var(--bg-ivory)]",
  cream: "bg-[var(--bg-cream)]",
  ink: "text-[var(--ink)]",
  inkMuted: "text-[var(--ink-muted)]",
  line: "border-[var(--line)]",
  navy: "text-[var(--navy)]",
  brown: "text-[var(--brown)]",
} as const;

export const editorialBorder = "border border-[var(--line)]";

export const editorialSurface = {
  square: "rounded-none bg-[var(--bg-ivory)]",
  squareCream: "rounded-none bg-[var(--bg-cream)]",
  core: "editorial-core-surface rounded-none bg-[var(--bg-ivory)]",
} as const;

export const editorialTypography = {
  heading:
    "font-sans font-semibold tracking-tight text-[clamp(1.5rem,2.5vw,2.75rem)] text-[var(--ink)]",
  subheading: "font-sans text-[clamp(1.125rem,2vw,1.5rem)] text-[var(--ink)]",
  body: "font-sans text-[var(--ink)]",
  bodyMuted: "font-sans text-[var(--ink-muted)]",
  label:
    "font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-muted)]",
} as const;
