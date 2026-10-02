export type DecorateStyleProfile =
  | "soft_playful"
  | "clean_modern"
  | "luxury_minimal"
  | "bright_friendly"
  | "calm_pastel"
  | "none";

const PROFILE_RULES: Array<{ profile: Exclude<DecorateStyleProfile, "none">; tokens: RegExp }> = [
  { profile: "soft_playful", tokens: /(귀엽|말랑|큐트|soft|playful|cute)/i },
  { profile: "luxury_minimal", tokens: /(고급|세련|luxury|minimal|품격)/i },
  { profile: "clean_modern", tokens: /(깔끔|정돈|모던|clean|modern|심플)/i },
  { profile: "bright_friendly", tokens: /(밝|친근|friendly|생기|활기)/i },
  { profile: "calm_pastel", tokens: /(차분|파스텔|감성|calm|pastel)/i },
];

export const normalizeDecorateStyleProfile = (input: { prompt: string; sourceIntent?: string }) => {
  const normalized = input.prompt.trim().toLowerCase();
  const matched = PROFILE_RULES.find((rule) => rule.tokens.test(normalized));
  if (!matched) {
    return { profile: "none" as const, confidence: 0.22, sourceIntent: input.sourceIntent ?? "unknown" };
  }
  return {
    profile: matched.profile,
    confidence: 0.78,
    sourceIntent: input.sourceIntent ?? "prompt_token",
  };
};
