import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { DecorateSemanticSectionsResult } from "@/lib/edu/lesson/decorateSemanticSections";
import type { DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";

export const evaluateSemanticDecorateCoherence = (input: {
  plan: DecoratePlanV1;
  styleIntent: DecorateStyleIntent;
  semantic: Pick<DecorateSemanticSectionsResult, "semanticSections" | "hasHero" | "hasCTA" | "hasCards">;
}) => {
  const penalties: string[] = [];
  const matchedSemanticKinds: string[] = [];
  const missingSemanticKinds: string[] = [];
  const selectors = input.plan.ops.flatMap((op) => (op.target.kind === "selector" ? [op.target.selector] : []));

  const hasMatchFor = (kind: string) => input.semantic.semanticSections.some((section) => section.kind === kind && selectors.some((selector) => selector.includes(section.selector.split(" ")[0] ?? "")));

  if (input.styleIntent === "cta_emphasis") {
    if (input.semantic.hasCTA) {
      if (hasMatchFor("cta") || hasMatchFor("footer_cta")) matchedSemanticKinds.push("cta");
      else { missingSemanticKinds.push("cta"); penalties.push("cta_not_targeted"); }
    }
  }
  if (input.styleIntent === "headline_emphasis") {
    if (input.semantic.hasHero) {
      if (hasMatchFor("hero")) matchedSemanticKinds.push("hero");
      else { missingSemanticKinds.push("hero"); penalties.push("hero_headline_missed"); }
    }
  }
  if (input.styleIntent === "card_tone") {
    if (input.semantic.hasCards) {
      if (hasMatchFor("card_grid") || hasMatchFor("feature_list")) matchedSemanticKinds.push("card_grid");
      else { missingSemanticKinds.push("card_grid"); penalties.push("card_group_missed"); }
    }
  }

  if (input.styleIntent === "playful_bright_style" || input.styleIntent === "luxury_clean_style") {
    if (input.plan.ops.length > 4) penalties.push("vague_prompt_over_mutation");
  }

  const score = Math.max(0, Math.min(1, Number((1 - penalties.length * 0.18 + matchedSemanticKinds.length * 0.08).toFixed(2))));
  return { score, matchedSemanticKinds, missingSemanticKinds, penalties };
};
