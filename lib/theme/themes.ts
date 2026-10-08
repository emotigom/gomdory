export const GOM_THEME_STORAGE_KEY = "gom.theme.v2";
export const GOM_THEME_LEGACY_STORAGE_KEY = "gom.theme";

export const GOM_THEME_IDS = [
  "gomdory-studio",
  "classroom-ivory",
  "minimal-hud",
  "high-contrast-light",
  "high-contrast-dark",
  "projector",
  "color-safe",
] as const;

export type GomThemeId = (typeof GOM_THEME_IDS)[number];

export const DEFAULT_GOM_THEME: GomThemeId = "gomdory-studio";

export type GomThemeTokenName =
  | "--theme-bg"
  | "--theme-bg-elevated"
  | "--theme-surface"
  | "--theme-surface-muted"
  | "--theme-card"
  | "--theme-card-muted"
  | "--theme-text"
  | "--theme-text-muted"
  | "--theme-text-subtle"
  | "--theme-border"
  | "--theme-border-strong"
  | "--theme-accent"
  | "--theme-accent-strong"
  | "--theme-accent-text"
  | "--theme-success"
  | "--theme-warning"
  | "--theme-danger"
  | "--theme-focus"
  | "--theme-shadow"
  | "--theme-code-bg"
  | "--theme-code-text"
  | "--theme-console-bg"
  | "--theme-console-text"
  | "--theme-radius"
  | "--theme-font-scale"
  | "--theme-control-height"
  | "--theme-backdrop-blur"
  | "--theme-grid-bg";

export type GomThemeDefinition = {
  id: GomThemeId;
  label: string;
  shortLabel: string;
  purpose: string;
  legacyDataTheme: "classic" | "hud";
  tokens: Record<GomThemeTokenName, string>;
};

export const GOM_THEMES: Record<GomThemeId, GomThemeDefinition> = {
  "gomdory-studio": {
    id: "gomdory-studio",
    label: "곰도리 작업실",
    shortLabel: "작업실",
    purpose: "따뜻한 종이색과 또렷한 잉크선으로 수업 작업대를 보여줍니다.",
    legacyDataTheme: "classic",
    tokens: {
      "--theme-bg": "#f5f0e6",
      "--theme-bg-elevated": "#fffdf7",
      "--theme-surface": "#fffdf7",
      "--theme-surface-muted": "#eee7d9",
      "--theme-card": "#fffdf7",
      "--theme-card-muted": "#f8f2e7",
      "--theme-text": "#19243a",
      "--theme-text-muted": "#4d5868",
      "--theme-text-subtle": "#596270",
      "--theme-border": "#b9b3a7",
      "--theme-border-strong": "#19243a",
      "--theme-accent": "#2d56d6",
      "--theme-accent-strong": "#1f3fa8",
      "--theme-accent-text": "#ffffff",
      "--theme-success": "#1f7a5b",
      "--theme-warning": "#b83f24",
      "--theme-danger": "#be123c",
      "--theme-focus": "#c53b1c",
      "--theme-shadow": "5px 5px 0 rgba(25,36,58,0.14)",
      "--theme-code-bg": "#111827",
      "--theme-code-text": "#eef4ff",
      "--theme-console-bg": "#0b1020",
      "--theme-console-text": "#eef4ff",
      "--theme-radius": "0.75rem",
      "--theme-font-scale": "1.025",
      "--theme-control-height": "3rem",
      "--theme-backdrop-blur": "0px",
      "--theme-grid-bg": "linear-gradient(rgba(25,36,58,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(25,36,58,0.055) 1px, transparent 1px)",
    },
  },
  "classroom-ivory": {
    id: "classroom-ivory",
    label: "아이보리",
    shortLabel: "아이보리",
    purpose: "따뜻한 아이보리 배경과 진한 남색 글자를 쓰는 기본 교실 테마입니다.",
    legacyDataTheme: "classic",
    tokens: {
      "--theme-bg": "#fbf7ef",
      "--theme-bg-elevated": "#fffdf8",
      "--theme-surface": "#ffffff",
      "--theme-surface-muted": "#f3efe6",
      "--theme-card": "#ffffff",
      "--theme-card-muted": "#f8f3ea",
      "--theme-text": "#111827",
      "--theme-text-muted": "#475569",
      "--theme-text-subtle": "#59677c",
      "--theme-border": "#cbd5e1",
      "--theme-border-strong": "#64748b",
      "--theme-accent": "#0f766e",
      "--theme-accent-strong": "#115e59",
      "--theme-accent-text": "#ffffff",
      "--theme-success": "#047857",
      "--theme-warning": "#b45309",
      "--theme-danger": "#b91c1c",
      "--theme-focus": "#2563eb",
      "--theme-shadow": "0 20px 52px -36px rgba(15, 23, 42, 0.45)",
      "--theme-code-bg": "#f8fafc",
      "--theme-code-text": "#0f172a",
      "--theme-console-bg": "#0f172a",
      "--theme-console-text": "#e2e8f0",
      "--theme-radius": "1rem",
      "--theme-font-scale": "1",
      "--theme-control-height": "2.75rem",
      "--theme-backdrop-blur": "0px",
      "--theme-grid-bg": "linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)",
    },
  },
  "minimal-hud": {
    id: "minimal-hud",
    label: "OLD · 오리지널 HUD",
    shortLabel: "OLD",
    purpose: "기존 HUD의 어두운 색과 반투명 패널을 사용합니다.",
    legacyDataTheme: "hud",
    tokens: {
      "--theme-bg": "#070b14",
      "--theme-bg-elevated": "#0d1525",
      "--theme-surface": "rgba(12,20,36,0.94)",
      "--theme-surface-muted": "rgba(20,32,52,0.86)",
      "--theme-card": "rgba(14,24,40,0.96)",
      "--theme-card-muted": "rgba(18,30,50,0.92)",
      "--theme-text": "#e5edf8",
      "--theme-text-muted": "#c6d5ea",
      "--theme-text-subtle": "#9fb0c8",
      "--theme-border": "rgba(148,163,184,0.45)",
      "--theme-border-strong": "#7dd3fc",
      "--theme-accent": "#38bdf8",
      "--theme-accent-strong": "#67e8f9",
      "--theme-accent-text": "#06111f",
      "--theme-success": "#34d399",
      "--theme-warning": "#fbbf24",
      "--theme-danger": "#fb7185",
      "--theme-focus": "#fde047",
      "--theme-shadow": "0 22px 70px -46px rgba(56, 189, 248, 0.5)",
      "--theme-code-bg": "#0b1220",
      "--theme-code-text": "#e5edf8",
      "--theme-console-bg": "#020617",
      "--theme-console-text": "#dbeafe",
      "--theme-radius": "1rem",
      "--theme-font-scale": "1",
      "--theme-control-height": "2.75rem",
      "--theme-backdrop-blur": "10px",
      "--theme-grid-bg": "linear-gradient(rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.08) 1px, transparent 1px)",
    },
  },
  "high-contrast-light": {
    id: "high-contrast-light",
    label: "고대비 밝게",
    shortLabel: "고대비 밝게",
    purpose: "흰 배경, 검정 글자, 두꺼운 테두리와 강한 포커스 링을 쓰는 접근성 테마입니다.",
    legacyDataTheme: "classic",
    tokens: {
      "--theme-bg": "#ffffff",
      "--theme-bg-elevated": "#ffffff",
      "--theme-surface": "#ffffff",
      "--theme-surface-muted": "#f1f5f9",
      "--theme-card": "#ffffff",
      "--theme-card-muted": "#f8fafc",
      "--theme-text": "#000000",
      "--theme-text-muted": "#1f2937",
      "--theme-text-subtle": "#374151",
      "--theme-border": "#111827",
      "--theme-border-strong": "#000000",
      "--theme-accent": "#0047ff",
      "--theme-accent-strong": "#0030b8",
      "--theme-accent-text": "#ffffff",
      "--theme-success": "#065f46",
      "--theme-warning": "#92400e",
      "--theme-danger": "#991b1b",
      "--theme-focus": "#ffbf00",
      "--theme-shadow": "0 0 0 2px #000000",
      "--theme-code-bg": "#ffffff",
      "--theme-code-text": "#000000",
      "--theme-console-bg": "#000000",
      "--theme-console-text": "#ffffff",
      "--theme-radius": "0.75rem",
      "--theme-font-scale": "1.04",
      "--theme-control-height": "3rem",
      "--theme-backdrop-blur": "0px",
      "--theme-grid-bg": "linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px)",
    },
  },
  "high-contrast-dark": {
    id: "high-contrast-dark",
    label: "고대비 어둡게",
    shortLabel: "고대비 어둡게",
    purpose: "어두운 교실과 저시력 사용자를 위한 검정 배경, 흰 글자, 노란 포커스 테마입니다.",
    legacyDataTheme: "classic",
    tokens: {
      "--theme-bg": "#000000",
      "--theme-bg-elevated": "#0a0a0a",
      "--theme-surface": "#111111",
      "--theme-surface-muted": "#1f1f1f",
      "--theme-card": "#111111",
      "--theme-card-muted": "#1a1a1a",
      "--theme-text": "#ffffff",
      "--theme-text-muted": "#f3f4f6",
      "--theme-text-subtle": "#d1d5db",
      "--theme-border": "#ffffff",
      "--theme-border-strong": "#fde047",
      "--theme-accent": "#22d3ee",
      "--theme-accent-strong": "#fde047",
      "--theme-accent-text": "#000000",
      "--theme-success": "#86efac",
      "--theme-warning": "#fde047",
      "--theme-danger": "#fca5a5",
      "--theme-focus": "#fde047",
      "--theme-shadow": "0 0 0 2px #ffffff",
      "--theme-code-bg": "#000000",
      "--theme-code-text": "#ffffff",
      "--theme-console-bg": "#000000",
      "--theme-console-text": "#ffffff",
      "--theme-radius": "0.75rem",
      "--theme-font-scale": "1.04",
      "--theme-control-height": "3rem",
      "--theme-backdrop-blur": "0px",
      "--theme-grid-bg": "linear-gradient(rgba(255,255,255,0.16) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
    },
  },
  projector: {
    id: "projector",
    label: "프로젝터",
    shortLabel: "프로젝터",
    purpose: "밝은 교실 프로젝터에서 더 큰 글자, 강한 버튼, 두꺼운 선으로 읽히는 테마입니다.",
    legacyDataTheme: "classic",
    tokens: {
      "--theme-bg": "#fffdf5",
      "--theme-bg-elevated": "#ffffff",
      "--theme-surface": "#ffffff",
      "--theme-surface-muted": "#fef3c7",
      "--theme-card": "#ffffff",
      "--theme-card-muted": "#fffbeb",
      "--theme-text": "#0f172a",
      "--theme-text-muted": "#334155",
      "--theme-text-subtle": "#475569",
      "--theme-border": "#475569",
      "--theme-border-strong": "#0f172a",
      "--theme-accent": "#1d4ed8",
      "--theme-accent-strong": "#1e40af",
      "--theme-accent-text": "#ffffff",
      "--theme-success": "#047857",
      "--theme-warning": "#b45309",
      "--theme-danger": "#b91c1c",
      "--theme-focus": "#f59e0b",
      "--theme-shadow": "0 10px 28px -22px rgba(15, 23, 42, 0.55)",
      "--theme-code-bg": "#f8fafc",
      "--theme-code-text": "#0f172a",
      "--theme-console-bg": "#111827",
      "--theme-console-text": "#f8fafc",
      "--theme-radius": "1.1rem",
      "--theme-font-scale": "1.12",
      "--theme-control-height": "3.25rem",
      "--theme-backdrop-blur": "0px",
      "--theme-grid-bg": "linear-gradient(rgba(15,23,42,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(15,23,42,0.10) 1px, transparent 1px)",
    },
  },
  "color-safe": {
    id: "color-safe",
    label: "색약 안전",
    shortLabel: "색약 안전",
    purpose: "빨강/초록만으로 상태를 구분하지 않도록 파랑·주황·보라 중심 토큰을 쓰는 테마입니다.",
    legacyDataTheme: "classic",
    tokens: {
      "--theme-bg": "#f7f7fb",
      "--theme-bg-elevated": "#ffffff",
      "--theme-surface": "#ffffff",
      "--theme-surface-muted": "#eef2ff",
      "--theme-card": "#ffffff",
      "--theme-card-muted": "#f5f3ff",
      "--theme-text": "#111827",
      "--theme-text-muted": "#374151",
      "--theme-text-subtle": "#4b5563",
      "--theme-border": "#a5b4fc",
      "--theme-border-strong": "#4338ca",
      "--theme-accent": "#2563eb",
      "--theme-accent-strong": "#7c3aed",
      "--theme-accent-text": "#ffffff",
      "--theme-success": "#2563eb",
      "--theme-warning": "#c2410c",
      "--theme-danger": "#7c3aed",
      "--theme-focus": "#f97316",
      "--theme-shadow": "0 18px 44px -34px rgba(67, 56, 202, 0.5)",
      "--theme-code-bg": "#f8fafc",
      "--theme-code-text": "#111827",
      "--theme-console-bg": "#111827",
      "--theme-console-text": "#e0e7ff",
      "--theme-radius": "1rem",
      "--theme-font-scale": "1.02",
      "--theme-control-height": "3rem",
      "--theme-backdrop-blur": "0px",
      "--theme-grid-bg": "linear-gradient(rgba(67,56,202,0.10) 1px, transparent 1px), linear-gradient(90deg, rgba(67,56,202,0.10) 1px, transparent 1px)",
    },
  },
};

export const GOM_THEME_OPTIONS = GOM_THEME_IDS.map((id) => GOM_THEMES[id]);

export function isGomThemeId(value: string | null | undefined): value is GomThemeId {
  return typeof value === "string" && (GOM_THEME_IDS as readonly string[]).includes(value);
}

export function normalizeStoredGomTheme(value: string | null | undefined): GomThemeId | null {
  if (value === "hud" || value === "minimal-hud") return "minimal-hud";
  if (value === "classic") return "classroom-ivory";
  return isGomThemeId(value) ? value : null;
}

export function getLegacyDataTheme(theme: GomThemeId): "classic" | "hud" {
  return GOM_THEMES[theme].legacyDataTheme;
}

export function getStoredGomTheme(): GomThemeId | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.localStorage.getItem(GOM_THEME_STORAGE_KEY);
    const storedTheme = normalizeStoredGomTheme(value);
    if (storedTheme) {
      if (value !== storedTheme) {
        window.localStorage.setItem(GOM_THEME_STORAGE_KEY, storedTheme);
      }
      return storedTheme;
    }

    const legacyValue = window.localStorage.getItem(GOM_THEME_LEGACY_STORAGE_KEY);
    const migratedTheme = normalizeStoredGomTheme(legacyValue);
    if (!migratedTheme) return null;
    window.localStorage.setItem(GOM_THEME_STORAGE_KEY, migratedTheme);
    return migratedTheme;
  } catch {
    return null;
  }
}

export function setStoredGomTheme(theme: GomThemeId): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(GOM_THEME_STORAGE_KEY, theme);
  } catch {
    // localStorage can be unavailable in restricted school browsers.
  }
}