export type BoardThemeVars = {
  "--theme-bg": string;
  "--theme-surface": string;
  "--theme-surface-muted": string;
  "--theme-card": string;
  "--theme-card-strong": string;
  "--theme-card-muted": string;
  "--theme-card-text": string;
  "--theme-card-muted-text": string;
  "--theme-card-link-text": string;
  "--theme-section-bg": string;
  "--theme-section-border": string;
  "--theme-section-text": string;
  "--theme-section-muted-text": string;
  "--theme-section-handle": string;
  "--theme-menu-bg": string;
  "--theme-menu-text": string;
  "--theme-menu-muted-text": string;
  "--theme-menu-border": string;
  "--theme-menu-hover-bg": string;
  "--theme-menu-danger-text": string;
  "--theme-menu-danger-hover-bg": string;
  "--theme-owner-badge-bg": string;
  "--theme-owner-badge-text": string;
  "--theme-owner-badge-border": string;
  "--theme-more-button-bg": string;
  "--theme-more-button-text": string;
  "--theme-more-button-border": string;
  "--theme-more-button-hover-bg": string;
  "--theme-file-badge-bg": string;
  "--theme-file-badge-text": string;
  "--theme-file-badge-border": string;
  "--theme-download-label-bg": string;
  "--theme-download-label-text": string;
  "--theme-download-label-border": string;
  "--theme-text": string;
  "--theme-text-muted": string;
  "--theme-text-subtle": string;
  "--theme-border": string;
  "--theme-border-strong": string;
  "--theme-focus": string;
  "--theme-accent": string;
  "--theme-accent-strong": string;
  "--theme-accent-text": string;
  "--theme-accent-contrast": string;
  "--theme-danger": string;
  "--theme-success": string;
  "--theme-topbar-bg": string;
  "--theme-topbar-text": string;
  "--theme-topbar-text-muted": string;
  "--theme-topbar-border": string;
  "--theme-topbar-pill-bg": string;
  "--theme-topbar-pill-text": string;
  "--theme-topbar-focus": string;
  "--theme-topbar-menu-bg": string;
  "--theme-topbar-menu-text": string;
  "--theme-topbar-menu-muted": string;
  "--theme-topbar-menu-border": string;
  "--theme-panel-strong": string;
  "--theme-action-text": string;
  "--board-bg-dim-opacity": string;
  "--board-surface-opacity": string;
};

export type BoardThemeTokens = { id: string; label: string; vars: BoardThemeVars };
export type PersistedBoardThemeInput =
  | BoardThemeTokens
  | {
      id?: unknown;
      label?: unknown;
      preset?: unknown;
      schemaVersion?: unknown;
      schema_version?: unknown;
      version?: unknown;
      vars?: unknown;
    }
  | string
  | null
  | undefined;
export type GuestViewThemeId = "follow-teacher" | "bright" | "contrast" | "calm" | "high-contrast";
export type BoardThemeRole = "teacher" | "student";

// BoardThemePresetId is persisted by teachers in boards.ui_theme_config.
// GuestViewThemeId is a student-only localStorage display override. Some labels
// intentionally match, but the storage location and effect are different.
export type BoardThemePresetId = typeof DEFAULT_BOARD_THEME.id | Exclude<GuestViewThemeId, "follow-teacher">;

// Use background/text tokens as role pairs. Do not put muted text directly on badges,
// pills, or download labels; those controls should use their dedicated token/class.
export const DEFAULT_BOARD_THEME: BoardThemeTokens = {
  id: "teacher-default-hud",
  label: "Teacher HUD",
  vars: {
    "--theme-bg": "#020617",
    "--theme-surface": "rgba(15,23,42,0.82)",
    "--theme-surface-muted": "rgba(30,41,59,0.72)",
    "--theme-card": "rgba(15,23,42,0.84)",
    "--theme-card-strong": "rgba(15,23,42,0.94)",
    "--theme-card-muted": "rgba(30,41,59,0.72)",
    "--theme-card-text": "#e2e8f0",
    "--theme-card-muted-text": "#cbd5e1",
    "--theme-card-link-text": "#bae6fd",
    "--theme-section-bg": "rgba(248,250,252,0.9)",
    "--theme-section-border": "rgba(255,255,255,0.7)",
    "--theme-section-text": "#0f172a",
    "--theme-section-muted-text": "#475569",
    "--theme-section-handle": "#94a3b8",
    "--theme-menu-bg": "#f8fafc",
    "--theme-menu-text": "#0f172a",
    "--theme-menu-muted-text": "#334155",
    "--theme-menu-border": "rgba(15,23,42,0.24)",
    "--theme-menu-hover-bg": "rgba(15,23,42,0.1)",
    "--theme-menu-danger-text": "#be123c",
    "--theme-menu-danger-hover-bg": "rgba(244,63,94,0.1)",
    "--theme-owner-badge-bg": "#dcfce7",
    "--theme-owner-badge-text": "#14532d",
    "--theme-owner-badge-border": "#86efac",
    "--theme-more-button-bg": "rgba(15,23,42,0.88)",
    "--theme-more-button-text": "#ffffff",
    "--theme-more-button-border": "rgba(255,255,255,0.34)",
    "--theme-more-button-hover-bg": "rgba(30,41,59,0.94)",
    "--theme-file-badge-bg": "#e0f2fe",
    "--theme-file-badge-text": "#0f172a",
    "--theme-file-badge-border": "rgba(14,116,144,0.52)",
    "--theme-download-label-bg": "rgba(224,242,254,0.16)",
    "--theme-download-label-text": "#e0f2fe",
    "--theme-download-label-border": "rgba(125,211,252,0.46)",
    "--theme-text": "#e2e8f0",
    "--theme-text-muted": "#94a3b8",
    "--theme-text-subtle": "#64748b",
    "--theme-border": "rgba(148,163,184,0.34)",
    "--theme-border-strong": "rgba(125,211,252,0.48)",
    "--theme-focus": "rgba(34,211,238,0.48)",
    "--theme-accent": "#06b6d4",
    "--theme-accent-strong": "#0891b2",
    "--theme-accent-text": "#ecfeff",
    "--theme-accent-contrast": "#ecfeff",
    "--theme-danger": "#fb7185",
    "--theme-success": "#34d399",
    "--theme-topbar-bg": "rgba(248, 250, 252, 0.92)",
    "--theme-topbar-text": "#0f172a",
    "--theme-topbar-text-muted": "#475569",
    "--theme-topbar-border": "rgba(15, 23, 42, 0.16)",
    "--theme-topbar-pill-bg": "rgba(255, 255, 255, 0.86)",
    "--theme-topbar-pill-text": "#0f172a",
    "--theme-topbar-focus": "#0891b2",
    "--theme-topbar-menu-bg": "rgba(248, 250, 252, 0.94)",
    "--theme-topbar-menu-text": "#0f172a",
    "--theme-topbar-menu-muted": "#475569",
    "--theme-topbar-menu-border": "rgba(15, 23, 42, 0.2)",
    "--theme-panel-strong": "rgba(2,6,23,0.48)",
    "--theme-action-text": "#ecfeff",
    "--board-bg-dim-opacity": "0.04",
    "--board-surface-opacity": "0.03",
  },
};

const GUEST_VIEW_THEME_OVERRIDES: Record<Exclude<GuestViewThemeId, "follow-teacher">, Partial<BoardThemeVars>> = {
  bright: {
    "--theme-bg": "#f8fafc",
    "--theme-surface": "rgba(255,255,255,0.74)",
    "--theme-surface-muted": "rgba(255,255,255,0.62)",
    "--theme-card": "rgba(255,255,255,0.92)",
    "--theme-card-strong": "rgba(255,255,255,0.96)",
    "--theme-card-muted": "#f1f5f9",
    "--theme-card-text": "#0f172a",
    "--theme-card-muted-text": "#334155",
    "--theme-card-link-text": "#075985",
    "--theme-section-bg": "rgba(255,255,255,0.92)",
    "--theme-section-border": "rgba(15,23,42,0.14)",
    "--theme-section-text": "#0f172a",
    "--theme-section-muted-text": "#475569",
    "--theme-section-handle": "#64748b",
    "--theme-menu-bg": "rgba(255,255,255,0.98)",
    "--theme-menu-text": "#0f172a",
    "--theme-menu-muted-text": "#475569",
    "--theme-menu-border": "rgba(15,23,42,0.18)",
    "--theme-menu-hover-bg": "rgba(15,23,42,0.06)",
    "--theme-more-button-bg": "#0f172a",
    "--theme-more-button-text": "#ffffff",
    "--theme-more-button-border": "rgba(15,23,42,0.22)",
    "--theme-more-button-hover-bg": "#1e293b",
    "--theme-file-badge-bg": "#e0f2fe",
    "--theme-file-badge-text": "#0f172a",
    "--theme-file-badge-border": "rgba(14,116,144,0.38)",
    "--theme-download-label-bg": "#f8fafc",
    "--theme-download-label-text": "#0f172a",
    "--theme-download-label-border": "rgba(15,23,42,0.22)",
    "--theme-text": "#0f172a",
    "--theme-text-muted": "#1e293b",
    "--theme-border": "rgba(15,23,42,0.18)",
    "--theme-focus": "rgba(14,165,233,0.5)",
    "--board-bg-dim-opacity": "0",
    "--board-surface-opacity": "0",
  },
  contrast: {
    "--theme-bg": "#020617",
    "--theme-surface": "rgba(15,23,42,0.9)",
    "--theme-surface-muted": "rgba(15,23,42,0.84)",
    "--theme-card": "rgba(15,23,42,0.92)",
    "--theme-card-strong": "rgba(2,6,23,0.96)",
    "--theme-card-muted": "rgba(30,41,59,0.84)",
    "--theme-card-text": "#ffffff",
    "--theme-card-muted-text": "#e0f2fe",
    "--theme-card-link-text": "#67e8f9",
    "--theme-section-bg": "rgba(2,6,23,0.92)",
    "--theme-section-border": "rgba(125,211,252,0.72)",
    "--theme-section-text": "#ffffff",
    "--theme-section-muted-text": "#dbeafe",
    "--theme-section-handle": "#bae6fd",
    "--theme-menu-bg": "rgba(2,6,23,0.98)",
    "--theme-menu-text": "#ffffff",
    "--theme-menu-muted-text": "#dbeafe",
    "--theme-menu-border": "rgba(125,211,252,0.72)",
    "--theme-menu-hover-bg": "rgba(34,211,238,0.16)",
    "--theme-menu-danger-text": "#fecdd3",
    "--theme-menu-danger-hover-bg": "rgba(251,113,133,0.18)",
    "--theme-owner-badge-bg": "#fef08a",
    "--theme-owner-badge-text": "#020617",
    "--theme-owner-badge-border": "#facc15",
    "--theme-more-button-bg": "#f8fafc",
    "--theme-more-button-text": "#020617",
    "--theme-more-button-border": "#f8fafc",
    "--theme-more-button-hover-bg": "#e0f2fe",
    "--theme-file-badge-bg": "#fef08a",
    "--theme-file-badge-text": "#020617",
    "--theme-file-badge-border": "#facc15",
    "--theme-download-label-bg": "rgba(254,240,138,0.16)",
    "--theme-download-label-text": "#fef9c3",
    "--theme-download-label-border": "rgba(254,240,138,0.62)",
    "--theme-text": "#ffffff",
    "--theme-text-muted": "#dbeafe",
    "--theme-border-strong": "rgba(125,211,252,0.85)",
    "--theme-focus": "rgba(253,224,71,0.75)",
    "--theme-accent": "#22d3ee",
    "--theme-accent-strong": "#06b6d4",
    "--theme-accent-contrast": "#ffffff",
    "--board-bg-dim-opacity": "0.08",
    "--board-surface-opacity": "0.05",
  },
  calm: {
    "--theme-bg": "#0b1120",
    "--theme-surface": "rgba(15,23,42,0.78)",
    "--theme-surface-muted": "rgba(30,41,59,0.68)",
    "--theme-card": "rgba(15,23,42,0.82)",
    "--theme-card-strong": "rgba(15,23,42,0.9)",
    "--theme-card-muted": "rgba(30,41,59,0.72)",
    "--theme-card-text": "#dbeafe",
    "--theme-card-muted-text": "#dbeafe",
    "--theme-card-link-text": "#bfdbfe",
    "--theme-section-bg": "rgba(15,23,42,0.78)",
    "--theme-section-border": "rgba(147,197,253,0.38)",
    "--theme-section-text": "#dbeafe",
    "--theme-section-muted-text": "#bfdbfe",
    "--theme-section-handle": "#93c5fd",
    "--theme-menu-bg": "rgba(15,23,42,0.94)",
    "--theme-menu-text": "#dbeafe",
    "--theme-menu-muted-text": "#bfdbfe",
    "--theme-menu-border": "rgba(147,197,253,0.42)",
    "--theme-menu-hover-bg": "rgba(147,197,253,0.14)",
    "--theme-owner-badge-bg": "#dbeafe",
    "--theme-owner-badge-text": "#0f172a",
    "--theme-owner-badge-border": "rgba(147,197,253,0.64)",
    "--theme-more-button-bg": "rgba(219,234,254,0.94)",
    "--theme-more-button-text": "#0f172a",
    "--theme-more-button-border": "rgba(219,234,254,0.7)",
    "--theme-more-button-hover-bg": "#bfdbfe",
    "--theme-file-badge-bg": "#dbeafe",
    "--theme-file-badge-text": "#0f172a",
    "--theme-file-badge-border": "rgba(96,165,250,0.5)",
    "--theme-download-label-bg": "rgba(191,219,254,0.16)",
    "--theme-download-label-text": "#dbeafe",
    "--theme-download-label-border": "rgba(147,197,253,0.44)",
    "--theme-text": "#dbeafe",
    "--theme-text-muted": "#bfdbfe",
    "--theme-text-subtle": "#93c5fd",
    "--theme-focus": "rgba(147,197,253,0.52)",
    "--theme-accent": "#60a5fa",
    "--theme-accent-strong": "#3b82f6",
    "--theme-danger": "#fda4af",
    "--board-bg-dim-opacity": "0.06",
    "--board-surface-opacity": "0.04",
  },

  "high-contrast": {
    "--theme-bg": "#000000",
    "--theme-surface": "#020617",
    "--theme-surface-muted": "#0f172a",
    "--theme-card": "#020617",
    "--theme-card-strong": "#000000",
    "--theme-card-muted": "#0f172a",
    "--theme-card-text": "#ffffff",
    "--theme-card-muted-text": "#e2e8f0",
    "--theme-card-link-text": "#7dd3fc",
    "--theme-section-bg": "#020617",
    "--theme-section-border": "rgba(255,255,255,0.75)",
    "--theme-section-text": "#ffffff",
    "--theme-section-muted-text": "#e2e8f0",
    "--theme-section-handle": "#ffffff",
    "--theme-menu-bg": "#020617",
    "--theme-menu-text": "#ffffff",
    "--theme-menu-muted-text": "#e2e8f0",
    "--theme-menu-border": "rgba(255,255,255,0.75)",
    "--theme-menu-hover-bg": "rgba(255,255,255,0.16)",
    "--theme-menu-danger-text": "#fecdd3",
    "--theme-menu-danger-hover-bg": "rgba(248,113,113,0.22)",
    "--theme-owner-badge-bg": "#ffffff",
    "--theme-owner-badge-text": "#020617",
    "--theme-owner-badge-border": "#f8fafc",
    "--theme-more-button-bg": "#ffffff",
    "--theme-more-button-text": "#020617",
    "--theme-more-button-border": "#f8fafc",
    "--theme-more-button-hover-bg": "#e2e8f0",
    "--theme-file-badge-bg": "#ffffff",
    "--theme-file-badge-text": "#020617",
    "--theme-file-badge-border": "#f8fafc",
    "--theme-download-label-bg": "#ffffff",
    "--theme-download-label-text": "#020617",
    "--theme-download-label-border": "#f8fafc",
    "--theme-text": "#ffffff",
    "--theme-text-muted": "#e2e8f0",
    "--theme-text-subtle": "#cbd5e1",
    "--theme-border": "rgba(255,255,255,0.56)",
    "--theme-border-strong": "#f8fafc",
    "--theme-focus": "#facc15",
    "--theme-accent": "#38bdf8",
    "--theme-accent-strong": "#0ea5e9",
    "--theme-accent-text": "#020617",
    "--theme-accent-contrast": "#020617",
    "--theme-danger": "#f87171",
    "--theme-success": "#4ade80",
    "--theme-topbar-bg": "#020617",
    "--theme-topbar-text": "#ffffff",
    "--theme-topbar-text-muted": "#e2e8f0",
    "--theme-topbar-border": "rgba(255,255,255,0.75)",
    "--theme-topbar-pill-bg": "#ffffff",
    "--theme-topbar-pill-text": "#020617",
    "--theme-topbar-focus": "#facc15",
    "--theme-topbar-menu-bg": "#020617",
    "--theme-topbar-menu-text": "#ffffff",
    "--theme-topbar-menu-muted": "#e2e8f0",
    "--theme-topbar-menu-border": "rgba(255,255,255,0.75)",
    "--board-bg-dim-opacity": "0.52",
    "--board-surface-opacity": "0.9",
  },
};

export const BOARD_THEME_PRESETS: BoardThemeTokens[] = [
  DEFAULT_BOARD_THEME,
  {
    id: "calm",
    label: "Calm",
    vars: { ...DEFAULT_BOARD_THEME.vars, ...GUEST_VIEW_THEME_OVERRIDES.calm },
  },
  {
    id: "bright",
    label: "Bright",
    vars: { ...DEFAULT_BOARD_THEME.vars, ...GUEST_VIEW_THEME_OVERRIDES.bright },
  },
  {
    id: "contrast",
    label: "Contrast",
    vars: { ...DEFAULT_BOARD_THEME.vars, ...GUEST_VIEW_THEME_OVERRIDES.contrast },
  },
  {
    id: "high-contrast",
    label: "High contrast",
    vars: { ...DEFAULT_BOARD_THEME.vars, ...GUEST_VIEW_THEME_OVERRIDES["high-contrast"] },
  },
];

export function getBoardThemePreset(id: BoardThemePresetId | string | null | undefined): BoardThemeTokens {
  return BOARD_THEME_PRESETS.find((preset) => preset.id === id) ?? DEFAULT_BOARD_THEME;
}

export function normalizeGuestViewThemeId(value: string | null | undefined): GuestViewThemeId {
  return value === "bright" || value === "contrast" || value === "calm" || value === "high-contrast" || value === "follow-teacher" ? value : "follow-teacher";
}

const BOARD_THEME_SCHEMA_VERSION = 1;
const BOARD_THEME_OPACITY_TOKENS = new Set<keyof BoardThemeVars>(["--board-bg-dim-opacity", "--board-surface-opacity"]);
const DANGEROUS_BOARD_THEME_CSS_VALUE_PATTERN = /(?:url\s*\(|var\s*\(|calc\s*\(|expression\s*\(|javascript\s*:)/i;
const COLOR_TOKEN_VALUE_PATTERN =
  /^(?:#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?|rgba?\(\s*(?:\d{1,3}(?:\.\d+)?%?\s*,\s*){2}\d{1,3}(?:\.\d+)?%?(?:\s*,\s*(?:0|1|0?\.\d+|\d{1,3}%))?\s*\)|hsla?\([^)]+\)|var\(--[a-zA-Z0-9-]+\)|color-mix\(in\s+[^)]+\))$/;

function normalizeBoardThemeSchemaVersion(input: { schemaVersion?: unknown; schema_version?: unknown; version?: unknown }) {
  const rawVersion = input.schemaVersion ?? input.schema_version ?? input.version;
  if (rawVersion === undefined || rawVersion === null) return BOARD_THEME_SCHEMA_VERSION;
  if (typeof rawVersion !== "number" || !Number.isInteger(rawVersion)) return null;
  return rawVersion;
}

function isValidBoardThemeTokenValue(key: keyof BoardThemeVars, value: string) {
  const normalized = value.trim();
  if (!normalized) return false;
  if (DANGEROUS_BOARD_THEME_CSS_VALUE_PATTERN.test(normalized)) return false;

  if (BOARD_THEME_OPACITY_TOKENS.has(key)) {
    const numeric = Number(normalized);
    return Number.isFinite(numeric) && numeric >= 0 && numeric <= 1;
  }

  return COLOR_TOKEN_VALUE_PATTERN.test(normalized);
}

export function normalizePersistedBoardTheme(value: PersistedBoardThemeInput): BoardThemeTokens | null {
  if (!value) return null;

  if (typeof value === "string") {
    return value === DEFAULT_BOARD_THEME.id ? DEFAULT_BOARD_THEME : null;
  }

  if (typeof value !== "object") return null;

  const input = value as { id?: unknown; label?: unknown; preset?: unknown; schemaVersion?: unknown; schema_version?: unknown; version?: unknown; vars?: unknown };
  const schemaVersion = normalizeBoardThemeSchemaVersion(input);
  if (schemaVersion !== BOARD_THEME_SCHEMA_VERSION) return null;

  if (typeof input.preset === "string" && input.preset.trim() && input.preset.trim() !== DEFAULT_BOARD_THEME.id) {
    return null;
  }

  const vars = input.vars && typeof input.vars === "object" ? input.vars as Record<string, unknown> : null;
  const normalizedVars: Partial<BoardThemeVars> = {};

  if (vars) {
    for (const key of Object.keys(DEFAULT_BOARD_THEME.vars) as Array<keyof BoardThemeVars>) {
      const tokenValue = vars[key];
      if (typeof tokenValue === "string" && isValidBoardThemeTokenValue(key, tokenValue)) {
        normalizedVars[key] = tokenValue.trim();
      }
    }
  }

  if (Object.keys(normalizedVars).length === 0) {
    return input.id === DEFAULT_BOARD_THEME.id ? DEFAULT_BOARD_THEME : null;
  }

  return {
    id: typeof input.id === "string" && input.id.trim() ? input.id.trim() : DEFAULT_BOARD_THEME.id,
    label: typeof input.label === "string" && input.label.trim() ? input.label.trim() : DEFAULT_BOARD_THEME.label,
    vars: { ...DEFAULT_BOARD_THEME.vars, ...normalizedVars },
  };
}

export function resolveBoardThemeVars(theme: BoardThemeTokens | null | undefined, role: BoardThemeRole): BoardThemeVars {
  const base = { ...DEFAULT_BOARD_THEME.vars, ...(theme?.vars ?? {}) };
  return role === "teacher"
    ? { ...base, "--board-surface-opacity": base["--board-surface-opacity"] || "0.28" }
    : { ...base, "--board-surface-opacity": "0.12", "--board-bg-dim-opacity": base["--board-bg-dim-opacity"] || "0.08" };
}

export function resolveStudentBoardTheme({ boardTheme, guestViewTheme }: { boardTheme: BoardThemeTokens | null; guestViewTheme: GuestViewThemeId }): BoardThemeVars {
  const baseTheme = { ...DEFAULT_BOARD_THEME, ...(boardTheme ?? {}) };
  const baseVars = resolveBoardThemeVars(baseTheme, "student");
  if (guestViewTheme === "follow-teacher") return baseVars;
  return { ...baseVars, ...GUEST_VIEW_THEME_OVERRIDES[guestViewTheme] };
}
