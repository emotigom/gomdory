const STUDENT_DECORATE_NORMALIZATION_RULES: Array<{ pattern: RegExp; inject: string[] }> = [
  { pattern: /예쁘게/, inject: ["cute", "soft", "clean"] },
  { pattern: /깔끔하게/, inject: ["clean", "modern", "tidy"] },
  { pattern: /멋지게/, inject: ["luxury", "modern", "bold"] },
  { pattern: /눈에\s*띄게/, inject: ["emphasis", "standout", "cta"] },
  { pattern: /부드럽게/, inject: ["soft", "gentle"] },
  { pattern: /더\s*크게/, inject: ["headline", "large", "emphasis"] },
  { pattern: /바꿔줘/, inject: ["change", "rewrite"] },
  { pattern: /넣어줘/, inject: ["insert", "image", "add"] },
];

export const normalizeStudentDecoratePrompt = (prompt: string) => {
  const compact = prompt.trim().toLowerCase().replace(/\s+/, " ");
  const expanded = new Set<string>([compact]);
  for (const rule of STUDENT_DECORATE_NORMALIZATION_RULES) {
    if (rule.pattern.test(compact)) {
      for (const token of rule.inject) expanded.add(token);
    }
  }
  return Array.from(expanded).join(" ");
};

export const includesAnyNormalizedToken = (normalizedPrompt: string, tokens: readonly string[]) =>
  tokens.some((token) => normalizedPrompt.includes(token));
