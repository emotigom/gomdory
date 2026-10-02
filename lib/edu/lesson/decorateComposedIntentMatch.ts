import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";

const hasAny = (kinds: string[], expected: string[]) => expected.some((kind) => kinds.includes(kind));

export const evaluateComposedStyleIntentMatch = (input: {
  primaryStyleIntent: DecorateStyleIntent;
  plan: DecoratePlanV1;
}) => {
  const opKinds = input.plan.ops.map((op) => op.op);
  const matchKinds: string[] = [];
  const missingKinds: string[] = [];
  const penalties: string[] = [];

  if (input.primaryStyleIntent === "cta_emphasis") {
    if (hasAny(opKinds, ["set_button_style", "set_accent_style"])) matchKinds.push("cta_targeted");
    else missingKinds.push("missing_cta_target_style");
  }
  if (input.primaryStyleIntent === "headline_emphasis") {
    if (hasAny(opKinds, ["set_text_emphasis", "set_text_style", "emphasize_heading"])) matchKinds.push("headline_targeted");
    else missingKinds.push("missing_headline_style");
  }
  if (input.primaryStyleIntent === "cute_soft_style") {
    if (hasAny(opKinds, ["set_surface_tone", "set_section_style"])) matchKinds.push("soft_surface_present");
    else missingKinds.push("missing_soft_surface");
    if (hasAny(opKinds, ["set_button_style", "set_accent_style"])) matchKinds.push("accent_present");
  }
  if (input.primaryStyleIntent === "luxury_clean_style") {
    if (hasAny(opKinds, ["set_section_style", "set_surface_tone"])) matchKinds.push("clean_surface_present");
    if (hasAny(opKinds, ["set_accent_style"])) matchKinds.push("restrained_accent_present");
  }
  if (["card_tone", "section_tone"].includes(input.primaryStyleIntent)) {
    if (hasAny(opKinds, ["set_card_style", "set_section_style", "set_surface_tone"])) matchKinds.push("surface_tone_present");
    else missingKinds.push("missing_surface_tone");
  }

  if (opKinds.filter((kind) => ["set_button_style", "set_accent_style", "set_text_emphasis"].includes(kind)).length >= 3) {
    penalties.push("noisy_composition");
  }

  const rawScore = 1 - missingKinds.length * 0.22 - penalties.length * 0.1;
  const matchScore = Number(Math.max(0, Math.min(1, rawScore)).toFixed(2));

  return {
    matchScore,
    matchKinds,
    missingKinds,
    penalties,
    intentMatched: matchScore >= 0.6,
  };
};
