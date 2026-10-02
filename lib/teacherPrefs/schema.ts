import { z } from "zod";

export const TEACHER_UI_PREFS_VERSION = 2 as const;
export const TEACHER_UI_PREFS_STORAGE_KEY = "gomdory.teacherUiPrefs.v2";

const ShadowSchema = z.enum(["soft", "none"]);
const ThemeSchema = z.enum(["light", "dark", "custom"]);
const BackgroundModeSchema = z.enum(["color", "gradient", "image"]);
const FontFamilySchema = z.enum(["suit", "pretendard", "notoSansKr", "system"]);
const DensitySchema = z.enum(["spacious", "comfortable", "compact"]);

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const SAFE_GRADIENT = /^linear-gradient\((?:[^;{}]|rgba?\([^)]*\)|hsla?\([^)]*\))*\)$/i;
const MIN_BASE_FONT_SIZE = 14;
const MAX_BASE_FONT_SIZE = 20;
const MIN_TEXT_CONTRAST = 4.5;
const MAX_BACKGROUND_IMAGE_URL_LENGTH = 2048;
const MAX_GRADIENT_LENGTH = 240;

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const sanitizeHexColor = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;
  return HEX_COLOR.test(value.trim()) ? value.trim() : fallback;
};

const sanitizeImageUrl = (value: string | undefined) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_BACKGROUND_IMAGE_URL_LENGTH) return null;
  if (/\s/.test(trimmed)) return null;
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const sanitizeGradient = (value: string | undefined, fallback: string) => {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed.length > MAX_GRADIENT_LENGTH) return fallback;
  if (/url\s*\(/i.test(trimmed)) return fallback;
  return SAFE_GRADIENT.test(trimmed) ? trimmed : fallback;
};

const toRgb = (hex: string) => {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3 ? clean.split("").map((ch) => `${ch}${ch}`).join("") : clean;
  const int = Number.parseInt(normalized, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return { r, g, b };
};

const srgbToLinear = (channel: number) => {
  const normalized = channel / 255;
  return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
};

function contrastRatio(hexA: string, hexB: string) {
  const a = toRgb(hexA);
  const b = toRgb(hexB);
  const luminance = ({ r, g, b: blue }: { r: number; g: number; b: number }) =>
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(blue);
  const l1 = luminance(a);
  const l2 = luminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const teacherUiPrefsRawSchema = z.object({
  v: z.number().optional(),
  dashboardCardRadius: z.number().min(8).max(24),
  dashboardCardShadow: ShadowSchema,
  theme: ThemeSchema,
  backgroundMode: BackgroundModeSchema,
  backgroundColor: z.string(),
  backgroundGradient: z.string(),
  backgroundImageUrl: z.string().nullable(),
  textColor: z.string(),
  accentColor: z.string(),
  fontFamily: FontFamilySchema,
  density: DensitySchema,
  baseFontSize: z.number().min(MIN_BASE_FONT_SIZE).max(MAX_BASE_FONT_SIZE),
});

const TeacherUiPrefsPatchSchema = z.object({
  dashboardCardRadius: z.number().min(8).max(24).optional(),
  dashboardCardShadow: ShadowSchema.optional(),
  theme: ThemeSchema.optional(),
  backgroundMode: BackgroundModeSchema.optional(),
  backgroundColor: z.string().optional(),
  backgroundGradient: z.string().optional(),
  backgroundImageUrl: z.string().nullable().optional(),
  textColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontFamily: FontFamilySchema.optional(),
  density: DensitySchema.optional(),
  baseFontSize: z.number().min(MIN_BASE_FONT_SIZE).max(MAX_BASE_FONT_SIZE).optional(),
});

export type TeacherUiPrefs = z.infer<typeof teacherUiPrefsRawSchema> & { v: typeof TEACHER_UI_PREFS_VERSION };
export type TeacherUiPrefsPatch = z.infer<typeof TeacherUiPrefsPatchSchema>;

export const DEFAULT_TEACHER_UI_PREFS: TeacherUiPrefs = {
  v: TEACHER_UI_PREFS_VERSION,
  dashboardCardRadius: 16,
  dashboardCardShadow: "soft",
  theme: "light",
  backgroundMode: "color",
  backgroundColor: "#fdf9f2",
  backgroundGradient: "linear-gradient(135deg, #fdf9f2 0%, #f6f1e8 100%)",
  backgroundImageUrl: null,
  textColor: "#1e1b16",
  accentColor: "#4f46e5",
  fontFamily: "suit",
  density: "comfortable",
  baseFontSize: 16,
};

function normalizeCommon(input: Partial<Omit<TeacherUiPrefs, "v">> & { v?: number }): TeacherUiPrefs {
  const next = {
    ...DEFAULT_TEACHER_UI_PREFS,
    ...input,
  };

  const backgroundColor = sanitizeHexColor(next.backgroundColor, DEFAULT_TEACHER_UI_PREFS.backgroundColor);
  const textColor = sanitizeHexColor(next.textColor, DEFAULT_TEACHER_UI_PREFS.textColor);

  const guardedTextColor =
    contrastRatio(backgroundColor, textColor) < MIN_TEXT_CONTRAST ? DEFAULT_TEACHER_UI_PREFS.textColor : textColor;
  const sanitizedBackgroundImageUrl = sanitizeImageUrl(next.backgroundImageUrl ?? undefined);
  const guardedBackgroundMode = next.backgroundMode === "image" && !sanitizedBackgroundImageUrl ? "color" : next.backgroundMode;

  return {
    ...next,
    v: TEACHER_UI_PREFS_VERSION,
    dashboardCardRadius: clampNumber(Math.round(next.dashboardCardRadius), 8, 24),
    backgroundMode: guardedBackgroundMode,
    backgroundColor,
    backgroundGradient: sanitizeGradient(next.backgroundGradient, DEFAULT_TEACHER_UI_PREFS.backgroundGradient),
    backgroundImageUrl: sanitizedBackgroundImageUrl,
    textColor: guardedTextColor,
    accentColor: sanitizeHexColor(next.accentColor, DEFAULT_TEACHER_UI_PREFS.accentColor),
    baseFontSize: clampNumber(Math.round(next.baseFontSize), MIN_BASE_FONT_SIZE, MAX_BASE_FONT_SIZE),
  };
}

export function normalizeTeacherUiPrefs(value: unknown): TeacherUiPrefs | null {
  const parsed = teacherUiPrefsRawSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  return normalizeCommon(parsed.data);
}

export function normalizeTeacherUiPrefsPatch(value: unknown): TeacherUiPrefsPatch | null {
  const parsed = TeacherUiPrefsPatchSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }

  const next = parsed.data;
  return {
    ...next,
    ...(typeof next.dashboardCardRadius === "number"
      ? { dashboardCardRadius: clampNumber(Math.round(next.dashboardCardRadius), 8, 24) }
      : null),
    ...(typeof next.baseFontSize === "number"
      ? { baseFontSize: clampNumber(Math.round(next.baseFontSize), MIN_BASE_FONT_SIZE, MAX_BASE_FONT_SIZE) }
      : null),
    ...(typeof next.backgroundColor === "string"
      ? { backgroundColor: sanitizeHexColor(next.backgroundColor, DEFAULT_TEACHER_UI_PREFS.backgroundColor) }
      : null),
    ...(typeof next.textColor === "string"
      ? { textColor: sanitizeHexColor(next.textColor, DEFAULT_TEACHER_UI_PREFS.textColor) }
      : null),
    ...(typeof next.accentColor === "string"
      ? { accentColor: sanitizeHexColor(next.accentColor, DEFAULT_TEACHER_UI_PREFS.accentColor) }
      : null),
    ...(typeof next.backgroundGradient === "string"
      ? { backgroundGradient: sanitizeGradient(next.backgroundGradient, DEFAULT_TEACHER_UI_PREFS.backgroundGradient) }
      : null),
    ...(next.backgroundImageUrl !== undefined ? { backgroundImageUrl: sanitizeImageUrl(next.backgroundImageUrl ?? undefined) } : null),
  };
}

export function mergeTeacherUiPrefs(base: TeacherUiPrefs, patch: TeacherUiPrefsPatch): TeacherUiPrefs {
  return normalizeCommon({ ...base, ...patch });
}
