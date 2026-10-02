import type { SlotMap } from "@/lib/edu/lesson/slotMap";
import type { DecorateStyleTargetKind } from "@/lib/edu/lesson/decorateStyleTargets";

export type DecorateSemanticSectionKind =
  | "hero"
  | "intro"
  | "cta"
  | "feature_list"
  | "card_grid"
  | "profile"
  | "gallery"
  | "footer_cta"
  | "primary_section"
  | "secondary_section";

export type DecorateSemanticSection = {
  kind: DecorateSemanticSectionKind;
  selector: string;
  confidence: number;
  signals: string[];
  childTargetKinds: DecorateStyleTargetKind[];
};

export type DecorateSemanticSectionsResult = {
  semanticSections: DecorateSemanticSection[];
  primarySectionKind: DecorateSemanticSectionKind | null;
  hasHero: boolean;
  hasCTA: boolean;
  hasCards: boolean;
};

const normalizeConfidence = (value: number) => Number(Math.max(0, Math.min(1, value)).toFixed(2));

const pushDetected = (
  list: DecorateSemanticSection[],
  kind: DecorateSemanticSectionKind,
  selector: string,
  confidence: number,
  signals: string[],
  childTargetKinds: DecorateStyleTargetKind[],
) => {
  if (list.some((section) => section.kind === kind && section.selector === selector)) return;
  list.push({ kind, selector, confidence: normalizeConfidence(confidence), signals, childTargetKinds });
};

const detectFirst = (doc: Document, selectors: string[]) => {
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (node) return selector;
  }
  return null;
};

export const detectDecorateSemanticSections = (input: {
  html: string;
  slotMap?: SlotMap | null;
  requestedTargetKinds?: DecorateStyleTargetKind[];
  existingSignals?: string[];
}): DecorateSemanticSectionsResult => {
  if (typeof DOMParser === "undefined") {
    return { semanticSections: [], primarySectionKind: null, hasHero: false, hasCTA: false, hasCards: false };
  }

  try {
    const doc = new DOMParser().parseFromString(input.html, "text/html");
    const sections: DecorateSemanticSection[] = [];
    const main = doc.querySelector("main") ?? doc.body;

    const heroSelector = detectFirst(doc, ["main section.hero", "main [data-section='hero']", "main .hero", "header.hero", "main > section:first-of-type h1"]);
    if (heroSelector) pushDetected(sections, "hero", heroSelector, 0.91, ["hero_selector_match"], ["headline_emphasis", "section_tone", "accent_emphasis"]);

    const introSelector = detectFirst(doc, ["main section.intro", "main [data-section='intro']", "main .intro", "main p.lead"]);
    if (introSelector) pushDetected(sections, "intro", introSelector, 0.82, ["intro_selector_match"], ["headline_emphasis", "section_tone"]);

    const ctaSelector = detectFirst(doc, ["main section.cta", "main [data-cta-section]", "main .cta-section", "main .cta", "main button.primary", "main .btn-primary"]);
    if (ctaSelector) pushDetected(sections, "cta", ctaSelector, 0.9, ["cta_selector_match"], ["cta_emphasis", "accent_emphasis"]);

    const featureSelector = detectFirst(doc, ["main section.features", "main [data-feature-list]", "main .feature-list", "main ul.features"]);
    if (featureSelector) pushDetected(sections, "feature_list", featureSelector, 0.84, ["feature_selector_match"], ["card_tone", "section_tone"]);

    const cardSelector = detectFirst(doc, ["main .card-grid", "main [data-card-grid]", "main .cards", "main .card-list"]);
    if (cardSelector) {
      pushDetected(sections, "card_grid", cardSelector, 0.88, ["card_grid_selector_match"], ["card_tone", "section_tone"]);
    } else {
      const repeatedCards = (main?.querySelectorAll(".card, [data-card], article, li")?.length ?? 0) >= 3;
      if (repeatedCards) pushDetected(sections, "card_grid", "main .card,[data-card],article,li", 0.68, ["repeated_card_like_nodes"], ["card_tone"]);
    }

    const profileSelector = detectFirst(doc, ["main section.profile", "main [data-profile]", "main .profile", "main article.profile"]);
    if (profileSelector) pushDetected(sections, "profile", profileSelector, 0.8, ["profile_selector_match"], ["section_tone", "headline_emphasis"]);

    const gallerySelector = detectFirst(doc, ["main section.gallery", "main [data-gallery]", "main .gallery"]);
    if (gallerySelector || (main?.querySelectorAll("img").length ?? 0) >= 4) {
      pushDetected(sections, "gallery", gallerySelector ?? "main img", gallerySelector ? 0.78 : 0.62, [gallerySelector ? "gallery_selector_match" : "image_density_detected"], ["section_tone", "accent_emphasis"]);
    }

    const footerCtaSelector = detectFirst(doc, ["footer .cta", "footer .btn", "footer [data-cta]", "footer section"]);
    if (footerCtaSelector) pushDetected(sections, "footer_cta", footerCtaSelector, 0.74, ["footer_cta_detected"], ["cta_emphasis", "accent_emphasis"]);

    const mainSections = Array.from(main?.querySelectorAll("section") ?? []);
    if (mainSections[0]) pushDetected(sections, "primary_section", "main section:first-of-type", 0.72, ["first_section_as_primary"], ["section_tone", "headline_emphasis"]);
    else if (input.slotMap?.section_any?.[0]) pushDetected(sections, "primary_section", input.slotMap.section_any[0], 0.64, ["slot_map_primary_section"], ["section_tone"]);

    if (mainSections[1]) pushDetected(sections, "secondary_section", "main section:nth-of-type(2)", 0.6, ["second_section_detected"], ["section_tone", "card_tone"]);

    const ranked = sections.sort((a, b) => b.confidence - a.confidence);
    const primarySectionKind = ranked.find((section) => section.kind !== "secondary_section")?.kind ?? null;
    const hasHero = ranked.some((section) => section.kind === "hero");
    const hasCTA = ranked.some((section) => section.kind === "cta" || section.kind === "footer_cta");
    const hasCards = ranked.some((section) => section.kind === "card_grid" || section.kind === "feature_list");

    return { semanticSections: ranked, primarySectionKind, hasHero, hasCTA, hasCards };
  } catch {
    return { semanticSections: [], primarySectionKind: null, hasHero: false, hasCTA: false, hasCards: false };
  }
};
