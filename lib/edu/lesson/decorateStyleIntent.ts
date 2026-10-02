import type { DecorateIntentSummary } from "@/lib/edu/lesson/decorateIntentRouter";
import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import { normalizeDecorateStyleProfile, type DecorateStyleProfile } from "@/lib/edu/lesson/decorateStyleProfile";
import { normalizeStudentDecoratePrompt, includesAnyNormalizedToken } from "@/lib/edu/lesson/studentPromptNormalization";

export type DecorateStyleIntent =
  | "background_color"
  | "background_gradient"
  | "surface_tone"
  | "accent_color"
  | "text_color_only"
  | "cta_emphasis"
  | "headline_emphasis"
  | "card_tone"
  | "section_tone"
  | "accent_emphasis"
  | "typography_tone"
  | "cute_soft_style"
  | "luxury_clean_style"
  | "playful_bright_style"
  | "none";

const BACKGROUND_TOKENS = ["배경", "배경색", "background", "surface", "hero"];
const GRADIENT_TOKENS = ["그라데이션", "gradient"];
const ACCENT_TOKENS = ["cta", "버튼", "button", "accent"];
const TEXT_COLOR_TOKENS = ["글자", "텍스트", "text"];
const SURFACE_TONE_TOKENS = ["톤", "tone", "파스텔", "네온", "보라", "빨강", "파랑"];
const CTA_TOKENS = ["cta", "버튼", "button", "클릭", "눈에 띄게", "눈에 띄", "잘 보이", "강하게"];
const HEADLINE_TOKENS = ["제목", "headline", "title", "헤드", "더 크게", "잘 보이게"];
const CARD_TOKENS = ["카드", "card"];
const SECTION_TOKENS = ["섹션", "section", "본문"];
const TYPO_TOKENS = ["가독", "폰트", "typography", "텍스트"];
const CUTE_TOKENS = ["귀엽", "말랑", "soft", "cute", "폭신", "동글", "부드럽"];
const LUXURY_TOKENS = ["고급", "세련", "luxury", "clean", "정돈", "멋지", "또렷"];
const PLAYFUL_TOKENS = ["발랄", "밝", "playful", "friendly"];

const includesAny = (value: string, tokens: string[]) => includesAnyNormalizedToken(value, tokens);
const hasOp = (plan: DecoratePlanV1, ops: string[]) => plan.ops.some((op) => ops.includes(op.op));

export const classifyDecorateStyleIntent = (input: { prompt: string; intent: DecorateIntentSummary }) => {
  const normalized = normalizeStudentDecoratePrompt(input.prompt);
  const colorTokens = Array.from(new Set(input.intent.colors.filter(Boolean)));
  const gradientRequested = includesAny(normalized, GRADIENT_TOKENS) || colorTokens.some((token) => GRADIENT_TOKENS.includes(token));
  const backgroundRequested = includesAny(normalized, BACKGROUND_TOKENS);
  const accentRequested = includesAny(normalized, ACCENT_TOKENS);
  const ctaRequested = includesAny(normalized, CTA_TOKENS);
  const headlineRequested = includesAny(normalized, HEADLINE_TOKENS);
  const textRequested = includesAny(normalized, TEXT_COLOR_TOKENS);
  const toneRequested = input.intent.tone.length > 0 || includesAny(normalized, SURFACE_TONE_TOKENS);

  let primaryStyleIntent: DecorateStyleIntent = "none";
  if (gradientRequested && (backgroundRequested || colorTokens.length > 0)) primaryStyleIntent = "background_gradient";
  else if (backgroundRequested && colorTokens.length > 0) primaryStyleIntent = "background_color";
  // Headline and CTA are distinct emphasis kinds; mixed phrasing resolves deterministically to headline when headline tokens are explicit.
  else if (headlineRequested && /크게|잘 보이|강조|또렷|emphasis/i.test(normalized)) primaryStyleIntent = "headline_emphasis";
  else if (headlineRequested) primaryStyleIntent = "headline_emphasis";
  else if (ctaRequested && /눈에 띄|강조|emphasis|잘 보이/i.test(normalized)) primaryStyleIntent = "cta_emphasis";
  else if (includesAny(normalized, CARD_TOKENS)) primaryStyleIntent = "card_tone";
  else if (includesAny(normalized, SECTION_TOKENS)) primaryStyleIntent = "section_tone";
  else if (includesAny(normalized, CUTE_TOKENS)) primaryStyleIntent = "cute_soft_style";
  else if (includesAny(normalized, LUXURY_TOKENS)) primaryStyleIntent = "luxury_clean_style";
  else if (includesAny(normalized, PLAYFUL_TOKENS)) primaryStyleIntent = "playful_bright_style";
  else if (accentRequested) primaryStyleIntent = "accent_color";
  else if (textRequested && colorTokens.length > 0) primaryStyleIntent = "text_color_only";
  else if (backgroundRequested || toneRequested) primaryStyleIntent = "surface_tone";

  const secondaryStyleIntents: DecorateStyleIntent[] = [];
  if (primaryStyleIntent === "cute_soft_style") secondaryStyleIntents.push("surface_tone", "headline_emphasis", "accent_emphasis");
  if (primaryStyleIntent === "luxury_clean_style") secondaryStyleIntents.push("section_tone", "typography_tone", "accent_emphasis");
  if (primaryStyleIntent === "playful_bright_style") secondaryStyleIntents.push("surface_tone", "accent_emphasis", "headline_emphasis");
  if (includesAny(normalized, TYPO_TOKENS)) secondaryStyleIntents.push("typography_tone");

  const profile = normalizeDecorateStyleProfile({ prompt: input.prompt, sourceIntent: input.intent.primaryIntent });
  const compositionHints = Array.from(new Set([
    profile.profile !== "none" ? `profile:${profile.profile}` : "profile:none",
    gradientRequested ? "gradient_preferred" : "flat_tone",
    accentRequested ? "accent_priority" : "accent_neutral",
  ]));

  const styleIntent = primaryStyleIntent;
  const confidence = styleIntent === "none" ? 0.2 : styleIntent.startsWith("background") ? 0.9 : 0.74;
  return {
    styleIntent,
    primaryStyleIntent,
    secondaryStyleIntents: Array.from(new Set(secondaryStyleIntents)),
    compositionHints,
    styleProfile: profile.profile as DecorateStyleProfile,
    profileConfidence: profile.confidence,
    colorTokens,
    gradientRequested,
    backgroundRequested,
    confidence,
  };
};

export const isBackgroundStyleIntent = (styleIntent: DecorateStyleIntent) =>
  styleIntent === "background_color" || styleIntent === "background_gradient" || styleIntent === "surface_tone";

export const shouldUseSlotResolverForDecorateIntent = (input: { styleIntent: DecorateStyleIntent; prompt: string }) => {
  if (!isBackgroundStyleIntent(input.styleIntent)) return true;
  return /(?:제목|글자|텍스트|button|버튼|cta)/i.test(input.prompt);
};

export const shouldAllowHtmlMutationForDecorateIntent = (input: { styleIntent: DecorateStyleIntent; prompt: string }) => {
  if (!isBackgroundStyleIntent(input.styleIntent)) return true;
  return /(?:제목|글자|텍스트|button|버튼|cta)/i.test(input.prompt);
};

export const evaluateDecorateIntentMatch = (input: { styleIntent: DecorateStyleIntent; plan: DecoratePlanV1 }) => {
  const opKinds = input.plan.ops.map((op) => op.op);
  const surfaceStyleChanged = hasOp(input.plan, ["set_surface_background", "set_surface_tone", "set_section_style"]);
  const accentStyleChanged = hasOp(input.plan, ["set_accent_style", "set_button_style"]);
  const typographyStyleChanged = hasOp(input.plan, ["set_text_style", "set_text_emphasis", "emphasize_heading"]);
  const htmlOnlyMutation = opKinds.every((op) => ["add_callout_box", "add_caption", "insert_media"].includes(op));
  const mismatchKinds: string[] = [];
  if (isBackgroundStyleIntent(input.styleIntent) && !surfaceStyleChanged) mismatchKinds.push("missing_surface_style_mutation");
  if (isBackgroundStyleIntent(input.styleIntent) && htmlOnlyMutation) mismatchKinds.push("background_intent_html_only_mutation");
  if (isBackgroundStyleIntent(input.styleIntent) && opKinds.includes("add_callout_box")) mismatchKinds.push("background_intent_callout_insertion");
  if (input.styleIntent === "cta_emphasis" && !accentStyleChanged) mismatchKinds.push("cta_intent_without_button_or_accent_style");
  if (input.styleIntent === "headline_emphasis" && !typographyStyleChanged) mismatchKinds.push("headline_intent_without_text_emphasis");
  return {
    intentMatched: mismatchKinds.length === 0,
    mismatchKinds,
    surfaceStyleChanged,
    accentStyleChanged,
    typographyStyleChanged,
    htmlOnlyMutation,
  };
};
