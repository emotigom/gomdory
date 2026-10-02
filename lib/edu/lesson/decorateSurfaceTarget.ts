export type DecorateSurfaceTarget = {
  targetType: "hero_surface" | "section_surface" | "page_surface" | "card_surface";
  selector: string;
  confidence: number;
  reason: string;
};

const pickFirst = (selectors: string[], fallback: string) => selectors.find(Boolean) ?? fallback;

export const resolveDecorateSurfaceTarget = (input: {
  sectionAny: string[];
  headingPrimary: string;
  textAny: string[];
}): DecorateSurfaceTarget => {
  const hero = input.sectionAny.find((selector) => /(hero|banner|main\s*>\s*section|section:nth-of-type\(1\))/i.test(selector));
  if (hero) return { targetType: "hero_surface", selector: hero, confidence: 0.92, reason: "hero_or_primary_section" };
  const section = input.sectionAny.find((selector) => selector.includes("section"));
  if (section) return { targetType: "section_surface", selector: section, confidence: 0.84, reason: "first_section_surface" };
  const page = pickFirst(["main", "body"], "main");
  if (page) return { targetType: "page_surface", selector: page, confidence: 0.72, reason: "page_level_surface" };
  const card = input.textAny.find((selector) => /div|article|card/i.test(selector)) ?? input.headingPrimary;
  return { targetType: "card_surface", selector: card, confidence: 0.55, reason: "card_group_fallback" };
};
