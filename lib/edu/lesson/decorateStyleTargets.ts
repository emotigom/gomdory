import type { SlotMap } from "@/lib/edu/lesson/slotMap";
import type { DecorateSemanticSection, DecorateSemanticSectionsResult } from "@/lib/edu/lesson/decorateSemanticSections";

export type DecorateStyleTargetKind = "cta_emphasis" | "headline_emphasis" | "card_tone" | "section_tone" | "accent_emphasis";

export type ResolvedDecorateStyleTarget = {
  kind: DecorateStyleTargetKind;
  selector: string;
  confidence: number;
  source: "dom_query" | "slot_map" | "safe_fallback" | "semantic";
  priority: number;
  semanticKind?: DecorateSemanticSection["kind"];
  resolverReason: string;
  provenance: "semantic" | "structural" | "heuristic";
};

const safeHead = <T,>(values: T[]) => values[0] ?? null;

const normalizeConfidence = (value: number) => Number(Math.max(0, Math.min(1, value)).toFixed(2));

const findFirstMatchingSelector = (html: string, selectors: string[]): string | null => {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    for (const selector of selectors) {
      const node = doc.querySelector(selector);
      if (node) return selector;
    }
  } catch {
    return null;
  }
  return null;
};

const pickSemanticTarget = (
  sections: DecorateSemanticSection[],
  preferredKinds: DecorateSemanticSection["kind"][],
  targetKind: DecorateStyleTargetKind,
) => sections.find((section) => preferredKinds.includes(section.kind) || section.childTargetKinds.includes(targetKind)) ?? null;

export const resolveDecorateStyleTargets = (input: {
  html: string;
  slotMap: SlotMap;
  targetKinds: DecorateStyleTargetKind[];
  semanticSections?: DecorateSemanticSectionsResult["semanticSections"];
}) => {
  const resolvedTargets: ResolvedDecorateStyleTarget[] = [];
  const unresolvedKinds: DecorateStyleTargetKind[] = [];
  const semanticSections = input.semanticSections ?? [];

  for (const kind of input.targetKinds) {
    let resolved: ResolvedDecorateStyleTarget | null = null;

    if (kind === "cta_emphasis") {
      const semantic = pickSemanticTarget(semanticSections, ["cta", "footer_cta", "hero"], kind);
      if (semantic) {
        resolved = { kind, selector: semantic.selector, confidence: Math.max(0.78, semantic.confidence), source: "semantic", priority: 0, semanticKind: semantic.kind, resolverReason: "semantic_cta_section_priority", provenance: "semantic" };
      } else {
        const preferred = findFirstMatchingSelector(input.html, [
          "main button.primary, main .btn-primary, main .cta, main [data-cta]",
          "main button,[role='button'],a.btn,a.cta,.btn,.cta",
        ]);
        if (preferred) resolved = { kind, selector: preferred, confidence: 0.93, source: "dom_query", priority: 1, resolverReason: "dom_cta_priority", provenance: "heuristic" };
        else resolved = { kind, selector: "button,[role='button'],.btn,.cta,a.btn,a.cta", confidence: 0.68, source: "safe_fallback", priority: 2, resolverReason: "safe_cta_fallback", provenance: "heuristic" };
      }
    }

    if (kind === "headline_emphasis") {
      const semantic = pickSemanticTarget(semanticSections, ["hero", "primary_section", "intro"], kind);
      if (semantic) {
        resolved = { kind, selector: semantic.selector, confidence: Math.max(0.76, semantic.confidence), source: "semantic", priority: 0, semanticKind: semantic.kind, resolverReason: "semantic_headline_priority", provenance: "semantic" };
      } else {
        const preferred = findFirstMatchingSelector(input.html, ["main h1", "section h1", "main h2", "h1,h2"]);
        if (preferred) resolved = { kind, selector: preferred, confidence: 0.92, source: "dom_query", priority: 1, resolverReason: "dom_headline_priority", provenance: "heuristic" };
        else if (input.slotMap.heading_primary) {
          resolved = { kind, selector: input.slotMap.heading_primary, confidence: 0.74, source: "slot_map", priority: 2, resolverReason: "slot_heading_primary", provenance: "structural" };
        }
      }
    }

    if (kind === "card_tone") {
      const semantic = pickSemanticTarget(semanticSections, ["card_grid", "feature_list", "secondary_section"], kind);
      if (semantic) {
        resolved = { kind, selector: semantic.selector, confidence: Math.max(0.75, semantic.confidence), source: "semantic", priority: 0, semanticKind: semantic.kind, resolverReason: "semantic_card_group_priority", provenance: "semantic" };
      } else {
        const preferred = findFirstMatchingSelector(input.html, [
          "main .card, main [data-card], main li, main article",
          ".card,[data-card],article,li",
        ]);
        if (preferred) resolved = { kind, selector: preferred, confidence: 0.88, source: "dom_query", priority: 1, resolverReason: "dom_card_priority", provenance: "heuristic" };
        else resolved = { kind, selector: ".card,[data-card],article,li", confidence: 0.62, source: "safe_fallback", priority: 3, resolverReason: "safe_card_fallback", provenance: "heuristic" };
      }
    }

    if (kind === "section_tone") {
      const semantic = pickSemanticTarget(semanticSections, ["primary_section", "hero", "intro"], kind);
      if (semantic) {
        resolved = { kind, selector: semantic.selector, confidence: Math.max(0.74, semantic.confidence), source: "semantic", priority: 0, semanticKind: semantic.kind, resolverReason: "semantic_primary_section_priority", provenance: "semantic" };
      } else {
        const preferred = findFirstMatchingSelector(input.html, ["main section.hero, main section.primary, main section", "main", "body"]);
        if (preferred) resolved = { kind, selector: preferred, confidence: preferred === "main" || preferred === "body" ? 0.72 : 0.9, source: "dom_query", priority: 1, resolverReason: "dom_section_priority", provenance: "heuristic" };
        else if (safeHead(input.slotMap.section_any)) {
          resolved = { kind, selector: safeHead(input.slotMap.section_any)!, confidence: 0.7, source: "slot_map", priority: 2, resolverReason: "slot_section_any", provenance: "structural" };
        }
      }
    }

    if (kind === "accent_emphasis") {
      const semantic = pickSemanticTarget(semanticSections, ["cta", "hero", "footer_cta"], kind);
      if (semantic) {
        resolved = { kind, selector: semantic.selector, confidence: Math.max(0.73, semantic.confidence), source: "semantic", priority: 0, semanticKind: semantic.kind, resolverReason: "semantic_accent_priority", provenance: "semantic" };
      } else {
        const preferred = findFirstMatchingSelector(input.html, ["main .badge, main a.primary, main .accent, main .cta", "a,.badge,.accent,.cta"]);
        if (preferred) resolved = { kind, selector: preferred, confidence: 0.84, source: "dom_query", priority: 1, resolverReason: "dom_accent_priority", provenance: "heuristic" };
        else resolved = { kind, selector: "a,.badge,.accent,.cta", confidence: 0.66, source: "safe_fallback", priority: 3, resolverReason: "safe_accent_fallback", provenance: "heuristic" };
      }
    }

    if (resolved) resolvedTargets.push({ ...resolved, confidence: normalizeConfidence(resolved.confidence) });
    else unresolvedKinds.push(kind);
  }

  const semanticKindsUsed = Array.from(new Set(resolvedTargets.map((target) => target.semanticKind).filter(Boolean))) as DecorateSemanticSection["kind"][];
  const provenanceKinds = Array.from(new Set(resolvedTargets.map((target) => target.provenance)));

  return {
    resolvedTargets,
    unresolvedKinds,
    confidences: resolvedTargets.map((target) => target.confidence),
    semanticKindsUsed,
    provenanceKinds,
    semanticCoverageScore: normalizeConfidence(input.targetKinds.length > 0 ? resolvedTargets.filter((target) => target.provenance === "semantic").length / input.targetKinds.length : 0),
  };
};
