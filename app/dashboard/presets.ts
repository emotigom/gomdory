"use client";

export type ClassPresetTarget = "class" | "present" | "share";
export type ClassPresetCardSize = "s" | "m" | "l";

export type ClassPresetSettings = {
  safeMode: boolean;
  focusMode: boolean;
  cardSize: ClassPresetCardSize;
  density?: "comfortable" | "compact";
  projectorPreset: boolean;
};

export type ClassPreset = {
  id: string;
  name: string;
  description?: string;
  target: ClassPresetTarget;
  settings: ClassPresetSettings;
};

const STORAGE_KEY = "gom:dashboard:class-presets";
const BOARD_STORAGE_PREFIX = "gom:dashboard:class-preset:board:";

const DEFAULT_PRESETS: ClassPreset[] = [
  {
    id: "preset_class_default",
    name: "수업 시작",
    description: "기본 수업 화면으로 빠르게 시작",
    target: "class",
    settings: {
      safeMode: true,
      focusMode: false,
      cardSize: "m",
      density: "comfortable",
      projectorPreset: false,
    },
  },
  {
    id: "preset_present_default",
    name: "발표",
    description: "프로젝터 중심 발표 세팅",
    target: "present",
    settings: {
      safeMode: false,
      focusMode: true,
      cardSize: "l",
      density: "comfortable",
      projectorPreset: true,
    },
  },
  {
    id: "preset_share_default",
    name: "학생 공유",
    description: "학생 피드 중심 공유",
    target: "share",
    settings: {
      safeMode: true,
      focusMode: false,
      cardSize: "l",
      density: "comfortable",
      projectorPreset: false,
    },
  },
];

const targets: ClassPresetTarget[] = ["class", "present", "share"];
const densities = ["comfortable", "compact"] as const;

export function getDefaultPresets(): ClassPreset[] {
  return DEFAULT_PRESETS.map((preset) => ({
    ...preset,
    settings: { ...preset.settings },
  }));
}

function normalizeSettings(raw: unknown): ClassPresetSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const settings = raw as Partial<ClassPresetSettings>;
  const cardSize =
    settings.cardSize === "s" || settings.cardSize === "m" || settings.cardSize === "l"
      ? settings.cardSize
      : null;
  if (!cardSize) return null;

  return {
    safeMode: Boolean(settings.safeMode),
    focusMode: Boolean(settings.focusMode),
    cardSize,
    density: densities.includes(settings.density ?? "" as (typeof densities)[number])
      ? (settings.density as ClassPresetSettings["density"])
      : undefined,
    projectorPreset: Boolean(settings.projectorPreset),
  };
}

function normalizePreset(raw: unknown): ClassPreset | null {
  if (!raw || typeof raw !== "object") return null;
  const preset = raw as Partial<ClassPreset>;
  if (!preset.id || typeof preset.id !== "string") return null;
  if (!preset.name || typeof preset.name !== "string") return null;
  if (!preset.target || !targets.includes(preset.target)) return null;
  const settings = normalizeSettings(preset.settings);
  if (!settings) return null;

  return {
    id: preset.id,
    name: preset.name,
    description: typeof preset.description === "string" ? preset.description : undefined,
    target: preset.target,
    settings,
  };
}

export function loadPresets(): ClassPreset[] {
  if (typeof window === "undefined") {
    return getDefaultPresets();
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return getDefaultPresets();
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      return getDefaultPresets();
    }
    const normalized = parsed.map(normalizePreset).filter((preset): preset is ClassPreset => Boolean(preset));
    return normalized.length > 0 ? normalized : getDefaultPresets();
  } catch {
    return getDefaultPresets();
  }
}

export function savePresets(presets: ClassPreset[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // ignore storage errors
  }
}

export function seedDefaultPresetsIfEmpty(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return false;
    savePresets(getDefaultPresets());
    return true;
  } catch {
    return false;
  }
}

export function loadBoardPreset(
  boardId: string,
  presets: ClassPreset[],
  target?: ClassPresetTarget,
): ClassPreset | null {
  if (typeof window === "undefined") return null;
  if (!boardId) return null;

  try {
    const stored = window.localStorage.getItem(`${BOARD_STORAGE_PREFIX}${boardId}`);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { presetId?: string } | string;
    const presetId = typeof parsed === "string" ? parsed : parsed?.presetId;
    if (!presetId) return null;
    const preset = presets.find((item) => item.id === presetId) ?? null;
    if (!preset) return null;
    if (target && preset.target !== target) return null;
    return preset;
  } catch {
    return null;
  }
}

export function saveBoardPreset(boardId: string, preset: ClassPreset) {
  if (typeof window === "undefined") return;
  if (!boardId) return;
  try {
    window.localStorage.setItem(`${BOARD_STORAGE_PREFIX}${boardId}`, JSON.stringify({ presetId: preset.id }));
  } catch {
    // ignore storage errors
  }
}

export function createPresetId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `preset_${Date.now()}`;
}

export function getDefaultPresetForTarget(presets: ClassPreset[], target: ClassPresetTarget): ClassPreset | null {
  return presets.find((preset) => preset.target === target) ?? null;
}

const CLASS_PREFS_STORAGE = "gom:class:ui-prefs";

function updateJsonStorage<T extends Record<string, unknown>>(storageKey: string, patch: T) {
  if (typeof window === "undefined") return;
  try {
    const stored = window.localStorage.getItem(storageKey);
    const parsed = stored ? (JSON.parse(stored) as Record<string, unknown>) : {};
    const next = { ...parsed, ...patch };
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
}

function mapCardSizeToPresent(cardSize: ClassPresetCardSize) {
  if (cardSize === "s") return "compact";
  if (cardSize === "l") return "large";
  return "default";
}

function mapCardSizeToFeed(cardSize: ClassPresetCardSize) {
  return cardSize === "l" ? "large" : "default";
}

export function applyPresetToStorage(
  preset: ClassPreset,
  options: { shareCode?: string | null },
) {
  if (typeof window === "undefined") return;

  if (preset.target === "class") {
    updateJsonStorage(CLASS_PREFS_STORAGE, {
      classSafeMode: preset.settings.safeMode,
      density: preset.settings.density ?? "comfortable",
    });
  }

  if (preset.target === "present" && options.shareCode) {
    const storageKey = `presentPrefs:${options.shareCode}`;
    const cardSize = mapCardSizeToPresent(preset.settings.cardSize);
    const basePatch: Record<string, unknown> = {
      safeMode: preset.settings.safeMode,
      focusMode: preset.settings.focusMode,
      cardSize,
    };

    updateJsonStorage(storageKey, basePatch);

    if (preset.settings.projectorPreset) {
      updateJsonStorage(storageKey, {
        theme: "contrast",
        zoom: 1.18,
        showHints: false,
        cardSize: "large",
        focusMode: true,
      });
    }
  }

  if (preset.target === "share" && options.shareCode) {
    const shareCode = options.shareCode;
    const feedSize = mapCardSizeToFeed(preset.settings.cardSize);
    try {
      window.localStorage.setItem("studentSafeMode", preset.settings.safeMode ? "1" : "0");
      window.localStorage.setItem(`studentFeedCardSize:${shareCode}`, feedSize);
      window.localStorage.setItem(`studentViewMode:${shareCode}`, "feed");
    } catch {
      // ignore storage errors
    }
  }
}

export function formatPresetEffects(settings: ClassPresetSettings) {
  return [
    `Safe ${settings.safeMode ? "ON" : "OFF"}`,
    `Focus ${settings.focusMode ? "ON" : "OFF"}`,
    `카드 ${settings.cardSize.toUpperCase()}`,
  ];
}
