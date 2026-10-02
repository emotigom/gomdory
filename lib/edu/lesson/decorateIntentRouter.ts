import { normalizeStudentDecoratePrompt } from "@/lib/edu/lesson/studentPromptNormalization";

export type DecoratePrimaryIntent = "color" | "tone" | "emphasis" | "text_rewrite" | "image_replace" | "layout" | "ambiguous";

export type DecorateIntentSummary = {
  primaryIntent: DecoratePrimaryIntent;
  secondaryIntents: DecoratePrimaryIntent[];
  colors: string[];
  tone: string[];
  emphasisTargets: string[];
  imageTargets: string[];
  rewriteTargets: string[];
  confidence: number;
  isAmbiguous: boolean;
};

const COLOR_TOKENS = [
  "빨강", "파랑", "초록", "보라", "핑크", "노랑", "주황", "그라데이션", "gradient", "red", "blue", "green", "purple", "pink", "yellow", "orange", "pastel", "네온",
] as const;
const TONE_TOKENS = ["귀엽", "말랑", "차분", "고급", "심플", "깔끔", "감성", "cute", "soft", "calm", "luxury", "clean", "modern"] as const;
const EMPHASIS_TOKENS = ["cta", "버튼", "button", "제목", "헤드", "headline", "카드", "섹션", "강조", "눈에 띄", "크게", "잘 보이"] as const;
const REWRITE_TOKENS = ["문구", "텍스트", "카피", "rewrite", "reword", "바꿔", "수정", "고쳐"] as const;
const IMAGE_TOKENS = ["사진", "이미지", "img", "image", "photo", "picture", "고양이", "cat"] as const;
const LAYOUT_TOKENS = ["레이아웃", "배치", "정렬", "간격", "spacing", "layout", "grid"] as const;

const unique = (values: string[]) => [...new Set(values)];

const hits = (text: string, tokens: readonly string[]) => tokens.filter((token) => text.includes(token));

const resolvePrimary = (counts: Record<DecoratePrimaryIntent, number>): DecoratePrimaryIntent => {
  const entries = Object.entries(counts) as Array<[DecoratePrimaryIntent, number]>;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0]?.[1] ? entries[0][0] : "ambiguous";
};

export const routeDecorateIntent = (prompt: string): DecorateIntentSummary => {
  const normalized = normalizeStudentDecoratePrompt(prompt);
  const rawNormalized = prompt.trim().toLowerCase();
  const hasBackgroundRequest = /배경|배경색|첫 화면|첫화면|hero|background/.test(rawNormalized);
  const hasImageRequest = /사진\s*자리|이미지\s*자리|이미지\s*칸|사진\s*칸|사진 넣|이미지 넣|넣어줘/.test(rawNormalized);
  const hasHeadlineRequest = /제목|headline|title|헤드/.test(rawNormalized);
  const hasButtonRequest = /버튼|button|cta/.test(rawNormalized);
  const hasFriendlyToneRequest = /귀엽|말랑|세련|멋지|부드럽|따뜻|깔끔/.test(rawNormalized);
  const colors = unique(hits(normalized, COLOR_TOKENS));
  const tone = unique(hits(normalized, TONE_TOKENS));
  const emphasisTargets = unique(hits(normalized, EMPHASIS_TOKENS));
  const rewriteTargets = unique(hits(normalized, REWRITE_TOKENS));
  const imageTargets = unique(hits(normalized, IMAGE_TOKENS));
  const layoutTargets = unique(hits(normalized, LAYOUT_TOKENS));

  const scores: Record<DecoratePrimaryIntent, number> = {
    color: colors.length + (hasBackgroundRequest ? 1 : 0),
    tone: tone.length + (hasFriendlyToneRequest ? 1 : 0),
    emphasis: emphasisTargets.length + (hasHeadlineRequest || hasButtonRequest ? 1 : 0),
    text_rewrite: rewriteTargets.length,
    image_replace: imageTargets.length + (hasImageRequest ? 1 : 0),
    layout: layoutTargets.length,
    ambiguous: 0,
  };

  const matchedIntentCount = Object.values(scores).filter((value) => value > 0).length;
  const rawMatchedCount = [hits(rawNormalized, COLOR_TOKENS).length, hits(rawNormalized, TONE_TOKENS).length, hits(rawNormalized, EMPHASIS_TOKENS).length, hits(rawNormalized, IMAGE_TOKENS).length, hits(rawNormalized, REWRITE_TOKENS).length, hits(rawNormalized, LAYOUT_TOKENS).length].filter((value) => value > 0).length;
  const isVeryShort = rawNormalized.replace(/\s+/g, "").length <= 6;
  const safeStudentIntentDetected = hasBackgroundRequest || hasImageRequest || hasHeadlineRequest || hasButtonRequest || hasFriendlyToneRequest;
  const isAmbiguous = (rawMatchedCount === 0 && !safeStudentIntentDetected) || (isVeryShort && rawMatchedCount <= 1 && !safeStudentIntentDetected);
  const primaryIntent = isAmbiguous ? "ambiguous" : resolvePrimary(scores);

  const secondaryIntents = (Object.entries(scores) as Array<[DecoratePrimaryIntent, number]>)
    .filter(([intent, value]) => intent !== primaryIntent && value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([intent]) => intent);

  const confidence = isAmbiguous ? 0.35 : Math.min(0.95, 0.55 + matchedIntentCount * 0.1 + scores[primaryIntent] * 0.08);

  return {
    primaryIntent,
    secondaryIntents,
    colors,
    tone,
    emphasisTargets,
    imageTargets,
    rewriteTargets,
    confidence: Number(confidence.toFixed(2)),
    isAmbiguous,
  };
};
