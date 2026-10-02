import type { DecoratePlanV1 } from "@/lib/edu/lesson/decoratePlan";
import type { DecorateStyleIntent } from "@/lib/edu/lesson/decorateStyleIntent";
import type { DecorateStyleProfile } from "@/lib/edu/lesson/decorateStyleProfile";
import type { DecorateSemanticSectionsResult } from "@/lib/edu/lesson/decorateSemanticSections";
import type { ResolvedDecorateStyleTarget } from "@/lib/edu/lesson/decorateStyleTargets";

const byKind = (targets: ResolvedDecorateStyleTarget[], kind: ResolvedDecorateStyleTarget["kind"]) =>
  targets.filter((target) => target.kind === kind).sort((a, b) => a.priority - b.priority)[0] ?? null;

export const buildStructureGuidedDecorateComposition = (input: {
  styleProfile: DecorateStyleProfile;
  semantic: Pick<DecorateSemanticSectionsResult, "hasHero" | "hasCTA" | "hasCards" | "primarySectionKind" | "semanticSections">;
  primaryStyleIntent: DecorateStyleIntent;
}) => {
  const targetHints: string[] = [];
  const strategy = input.semantic.hasHero
    ? "hero_centered"
    : input.semantic.hasCTA
      ? "cta_centered"
      : input.semantic.hasCards
        ? "cards_centered"
        : "primary_section_balanced";

  if (input.semantic.hasHero) targetHints.push("hero_headline_first");
  if (input.semantic.hasCTA) targetHints.push("cta_action_visibility");
  if (input.semantic.hasCards) targetHints.push("repeated_card_consistency");
  if (input.styleProfile === "soft_playful") targetHints.push("soft_profile_core_regions_only");
  if (input.primaryStyleIntent === "section_tone" && !input.semantic.hasHero) targetHints.push("section_surface_focus");

  return {
    strategy,
    targetHints,
    semanticKindsUsed: input.semantic.semanticSections.map((section) => section.kind),
  };
};

export const buildDecorateStyleComposition = (input: {
  primaryStyleIntent: DecorateStyleIntent;
  secondaryStyleIntents: DecorateStyleIntent[];
  styleProfile: DecorateStyleProfile;
  colorTokens: string[];
  resolvedTargets?: ResolvedDecorateStyleTarget[];
  semantic?: Pick<DecorateSemanticSectionsResult, "hasHero" | "hasCTA" | "hasCards" | "primarySectionKind" | "semanticSections">;
}) => {
  const ops: DecoratePlanV1["ops"] = [];
  const targetKinds = new Set<string>();
  const droppedKinds: string[] = [];
  const refinedReasons: string[] = [];
  const targets = input.resolvedTargets ?? [];
  const structureGuide = buildStructureGuidedDecorateComposition({
    styleProfile: input.styleProfile,
    semantic: input.semantic ?? { hasHero: false, hasCTA: false, hasCards: false, primarySectionKind: null, semanticSections: [] },
    primaryStyleIntent: input.primaryStyleIntent,
  });

  const ctaTarget = byKind(targets, "cta_emphasis")?.selector ?? "button,[role='button'],.btn,.cta";
  const headlineTarget = byKind(targets, "headline_emphasis")?.selector;
  const cardTarget = byKind(targets, "card_tone")?.selector ?? ".card,[data-card],article,li";
  const sectionTarget = byKind(targets, "section_tone")?.selector;
  const accentTarget = byKind(targets, "accent_emphasis")?.selector ?? "a,.accent,.badge,.cta";

  const pushProfileOps = () => {
    if (input.styleProfile === "soft_playful") {
      ops.push({ op: "set_surface_tone", target: { kind: "selector", selector: sectionTarget ?? "main" }, style: { background: "#fdf2f8", textColor: "#4c1d95", radiusLevel: "lg", shadowLevel: "sm" } });
      if (headlineTarget) ops.push({ op: "set_text_emphasis", target: { kind: "selector", selector: headlineTarget }, style: { emphasisStrength: "medium" } });
      ops.push({ op: "set_accent_style", target: { kind: "selector", selector: accentTarget }, style: { accentColor: "#f472b6", textColor: "#3b0764", emphasisStrength: "subtle" } });
      targetKinds.add("surface"); targetKinds.add("headline"); targetKinds.add("accent");
      refinedReasons.push("soft_profile_limited_to_surface_headline_accent");
    }
    if (input.styleProfile === "luxury_minimal" || input.styleProfile === "clean_modern") {
      ops.push({ op: "set_section_style", target: sectionTarget ? { kind: "selector", selector: sectionTarget } : { kind: "slot", slot: "section_any" }, style: { background: "#f8fafc", borderColor: "#cbd5e1", spacingToneHint: "balanced" } });
      ops.push({ op: "set_text_style", target: headlineTarget ? { kind: "selector", selector: headlineTarget } : { kind: "slot", slot: "heading_primary" }, style: { textColor: "#0f172a", contrastAdjust: "boost" } });
      ops.push({ op: "set_accent_style", target: { kind: "selector", selector: accentTarget }, style: { accentColor: "#334155", textColor: "#ffffff", emphasisStrength: "subtle" } });
      targetKinds.add("section"); targetKinds.add("typography"); targetKinds.add("accent");
      refinedReasons.push("luxury_profile_restrained_accent_typography");
    }
  };

  pushProfileOps();

  if (input.primaryStyleIntent === "cta_emphasis") {
    ops.push({ op: "set_button_style", target: { kind: "selector", selector: ctaTarget }, style: { background: "#2563eb", textColor: "#ffffff", borderColor: "#1d4ed8", emphasisStrength: "strong", shadowLevel: "sm", radiusLevel: "md" } });
    if (!ops.some((op) => op.op === "set_accent_style")) {
      ops.push({ op: "set_accent_style", target: { kind: "selector", selector: accentTarget }, style: { accentColor: "#2563eb", textColor: "#ffffff", emphasisStrength: "medium" } });
    } else {
      droppedKinds.push("set_accent_style_duplicate");
    }
    targetKinds.add("button");
    targetKinds.add("accent");
    refinedReasons.push("cta_focus_core_targets_only");
  }

  if (input.primaryStyleIntent === "headline_emphasis") {
    ops.push({ op: "set_text_emphasis", target: headlineTarget ? { kind: "selector", selector: headlineTarget } : { kind: "slot", slot: "heading_primary" }, style: { emphasisStrength: "strong" } });
    targetKinds.add("headline");
  }

  if (input.primaryStyleIntent === "card_tone") {
    ops.push({ op: "set_card_style", target: { kind: "selector", selector: cardTarget }, style: { background: "#ffffff", borderColor: "#e2e8f0", radiusLevel: "lg", shadowLevel: "sm" } });
    targetKinds.add("card");
  }

  if (input.primaryStyleIntent === "section_tone") {
    ops.push({ op: "set_section_style", target: sectionTarget ? { kind: "selector", selector: sectionTarget } : { kind: "slot", slot: "section_any" }, style: { background: "#f8fafc", spacingToneHint: "balanced" } });
    targetKinds.add("section");
  }

  if (input.primaryStyleIntent === "background_gradient") {
    const from = input.colorTokens[0] ?? "#ef4444";
    const to = input.colorTokens[1] ?? "#3b82f6";
    ops.push({ op: "set_surface_background", target: sectionTarget ? { kind: "selector", selector: sectionTarget } : { kind: "slot", slot: "section_any" }, style: { mode: "gradient", gradientFrom: from, gradientTo: to, textColor: "#ffffff" } });
    targetKinds.add("surface");
  }

  const dedupedOps = ops.filter((op, index, arr) => {
    if (index === 0) return true;
    const firstIndex = arr.findIndex((candidate) => candidate.op === op.op && JSON.stringify(candidate.target) === JSON.stringify(op.target));
    return firstIndex === index;
  });
  if (dedupedOps.length !== ops.length) refinedReasons.push("duplicate_visual_effect_removed");

  const finalOps = dedupedOps.slice(0, input.primaryStyleIntent === "cta_emphasis" ? 2 : 4);
  if (finalOps.length < dedupedOps.length) {
    droppedKinds.push("op_count_trimmed");
    refinedReasons.push("composition_trimmed_for_coherence");
  }

  return {
    ops: finalOps,
    opKinds: Array.from(new Set(finalOps.map((op) => op.op))),
    targetKinds: Array.from(targetKinds),
    strength: finalOps.length >= 4 ? "high" : finalOps.length >= 2 ? "medium" : "low",
    styleProfile: input.styleProfile,
    originalOpCount: ops.length,
    finalOpCount: finalOps.length,
    droppedKinds,
    refinedReasons: [...refinedReasons, `structure_strategy:${structureGuide.strategy}`, ...structureGuide.targetHints],
    compositionStrategy: structureGuide.strategy,
    semanticKindsUsed: structureGuide.semanticKindsUsed,
  };
};
