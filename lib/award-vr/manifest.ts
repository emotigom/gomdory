export type AwardVrAsset = {
  src: string;
  alt?: string;
  opacity?: number;
  width?: number;
  height?: number;
};

export type AwardVrTheme = {
  primary?: string;
  gold?: string;
  crimson?: string;
  background?: string;
};

export type AwardVrFaceDetectionConfig = {
  enabled?: boolean;
  provider?: "manual" | "mediapipe" | "tensorflow" | string;
  hudOpacity?: number;
  manualFallback?: boolean;
};

export type AwardVrBeautificationMode = "natural" | "bright" | "sharp" | "soft" | "mono" | "off";
export type AwardVrOutfitChoice = "none" | "tuxedo" | "dress" | "auto";
export type AwardVrResolvedOutfit = Exclude<AwardVrOutfitChoice, "auto">;

export type AwardVrBeautificationConfig = Partial<Record<AwardVrBeautificationMode, string>>;

export type AwardVrOutfitFit = {
  anchor?: "neck" | "chest" | "center" | string;
  defaultScale?: number;
  neckOffsetRatio?: number;
  centerYOffsetRatio?: number;
};

export type AwardVrManifest = {
  id: string;
  version: string;
  title: string;
  locale: string;
  r2BasePath: string;
  theme: AwardVrTheme;
  assets: {
    ui: {
      previewAwardVr?: AwardVrAsset;
      [key: string]: AwardVrAsset | undefined;
    };
    backgrounds: {
      stageMain?: AwardVrAsset;
      stageEmpty?: AwardVrAsset;
      redCarpetWalkway?: AwardVrAsset;
      [key: string]: AwardVrAsset | undefined;
    };
    overlays: {
      aiFaceHud?: AwardVrAsset;
      outfitTuxedo?: AwardVrAsset;
      outfitDress?: AwardVrAsset;
      [key: string]: AwardVrAsset | undefined;
    };
    objects: {
      teacherTrophy?: AwardVrAsset;
      [key: string]: AwardVrAsset | undefined;
    };
  };
  experience: {
    faceDetection: AwardVrFaceDetectionConfig;
    beautification: AwardVrBeautificationConfig;
    outfits: {
      fit?: AwardVrOutfitFit;
      choices?: AwardVrOutfitChoice[];
    };
    sequence: string[];
  };
  copy: Record<string, string>;
  accessibility: Record<string, string | boolean | number>;
  loading: Record<string, string | boolean | number>;
  compatibility: Record<string, string | boolean | number>;
};

export const AWARD_VR_R2_PUBLIC_BASE_URL = "https://assets.gomdory.com";
export const AWARD_VR_MANIFEST_PATH = "/public/events/teacher-day-2026/award-vr/manifest.json";
export const AWARD_VR_SAFE_FALLBACK_PREVIEW_PATH =
  "/public/events/teacher-day-2026/award-vr/ui/preview-award-vr.webp";

const normalizeBase = (baseUrl?: string) => (baseUrl ?? "").trim().replace(/\/+$/, "");

export function getAwardVrR2BaseUrl() {
  return normalizeBase(process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL) || AWARD_VR_R2_PUBLIC_BASE_URL;
}

export function getAwardVrManifestUrl(baseUrl = getAwardVrR2BaseUrl()) {
  const base = normalizeBase(baseUrl) || AWARD_VR_R2_PUBLIC_BASE_URL;
  return `${base}${AWARD_VR_MANIFEST_PATH}`;
}

export function resolveAwardAssetUrl(assetSrc?: string, baseUrl = getAwardVrR2BaseUrl()) {
  if (!assetSrc) {
    return "";
  }
  if (/^https?:\/\//i.test(assetSrc)) {
    return assetSrc;
  }
  const base = normalizeBase(baseUrl) || AWARD_VR_R2_PUBLIC_BASE_URL;
  const src = assetSrc.startsWith("/") ? assetSrc : `/${assetSrc}`;
  return `${base}${src}`;
}

export const DEFAULT_BEAUTIFICATION_FILTERS: Record<AwardVrBeautificationMode, string> = {
  natural: "brightness(1.06) contrast(1.06) saturate(1.08)",
  bright: "brightness(1.12) contrast(1.04) saturate(1.18)",
  sharp: "brightness(1.03) contrast(1.14) saturate(1.16)",
  soft: "brightness(1.07) contrast(0.98) saturate(1.06) blur(0.35px)",
  mono: "grayscale(1) contrast(1.08) brightness(1.04)",
  off: "brightness(1) contrast(1) saturate(1)",
};

export function getBeautificationFilter(
  mode: AwardVrBeautificationMode,
  manifest?: Pick<AwardVrManifest, "experience"> | null,
) {
  return manifest?.experience?.beautification?.[mode] ?? DEFAULT_BEAUTIFICATION_FILTERS[mode];
}

export function resolveAutoOutfit(
  selected: AwardVrOutfitChoice,
  lastSelected?: AwardVrResolvedOutfit | null,
): AwardVrResolvedOutfit {
  if (selected === "auto") {
    return lastSelected ?? "none";
  }
  return selected;
}

export const FALLBACK_AWARD_VR_MANIFEST: AwardVrManifest = {
  id: "teacher-day-award-vr-fallback",
  version: "fallback-1",
  title: "나만의 AI 포토 카드",
  locale: "ko-KR",
  r2BasePath: "/public/events/teacher-day-2026/award-vr",
  theme: {
    primary: "#f7d27a",
    gold: "#ffd66b",
    crimson: "#8f1233",
    background: "#06030a",
  },
  assets: {
    ui: {
      previewAwardVr: { src: AWARD_VR_SAFE_FALLBACK_PREVIEW_PATH, alt: "나만의 AI 포토 카드 미리보기" },
    },
    backgrounds: {
      stageMain: { src: "/public/events/teacher-day-2026/award-vr/backgrounds/stage-main.webp", alt: "포토 카드 완성 무대" },
      stageEmpty: { src: "/public/events/teacher-day-2026/award-vr/backgrounds/stage-empty.webp", alt: "포토 카드 촬영 무대" },
      redCarpetWalkway: { src: "/public/events/teacher-day-2026/award-vr/backgrounds/red-carpet-walkway.webp", alt: "레드카펫 입장로" },
    },
    overlays: {
      aiFaceHud: { src: "/public/events/teacher-day-2026/award-vr/overlays/ai-face-hud.webp", alt: "얼굴 인식 HUD", opacity: 0.62 },
      outfitTuxedo: { src: "/public/events/teacher-day-2026/award-vr/overlays/outfit-tuxedo.webp", alt: "턱시도 의상" },
      outfitDress: { src: "/public/events/teacher-day-2026/award-vr/overlays/outfit-dress.webp", alt: "드레스 의상" },
    },
    objects: {
      teacherTrophy: { src: "/public/events/teacher-day-2026/award-vr/objects/teacher-of-the-year-trophy.webp", alt: "포토 카드 장식 오브젝트" },
    },
  },
  experience: {
    faceDetection: { enabled: true, provider: "manual", hudOpacity: 0.62, manualFallback: true },
    beautification: DEFAULT_BEAUTIFICATION_FILTERS,
    outfits: { fit: { anchor: "neck", defaultScale: 3.15, neckOffsetRatio: 0.08, centerYOffsetRatio: 0.34 } },
    sequence: ["intro", "camera-permission", "face-detect", "style-select", "award-reveal", "result"],
  },
  copy: {
    title: "나만의 AI 포토 카드",
    tagline: "나만의 개성과 아이디어를 담아 포토 카드를 만들어 봐요",
    privacy: "카메라 화면은 얼굴 위치를 맞추기 위해 브라우저 안에서만 사용됩니다.",
    cameraPrivacyTitle: "안심하고 카메라를 켜도 괜찮아요",
    cameraPrivacyBody:
      "이 체험은 얼굴 위치를 맞추기 위해 카메라 화면을 브라우저 안에서만 사용합니다. 사진과 영상은 서버로 전송되지 않고, 별도로 저장되지 않습니다.",
    cameraPrivacyBulletLocalOnly: "브라우저 안에서만 처리",
    cameraPrivacyBulletNoUpload: "서버 업로드 없음",
    cameraPrivacyBulletNoAutoSave: "자동 저장 없음",
    cameraPrivacyNote: "포토 카드 저장하기를 누를 때만 내 기기에 이미지가 저장됩니다.",
    stylePrivacyNotice: "얼굴 보정과 의상 합성은 화면 연출용이며, 얼굴로 성별을 판단하지 않습니다. 의상은 사용자가 직접 선택합니다.",
  },
  accessibility: { reducedMotion: true, keyboard: true },
  loading: { eager: "stageMain,stageEmpty,aiFaceHud,outfitTuxedo,outfitDress" },
  compatibility: { cameraFallback: true, webShareFallback: true },
};
