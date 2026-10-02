# Decorate semantic targeting design

## Taxonomy
- `hero`, `intro`, `cta`, `feature_list`, `card_grid`, `profile`, `gallery`, `footer_cta`, `primary_section`, `secondary_section`

## Resolution rules
1. Detect semantic sections from lightweight DOM heuristics.
2. Resolve style targets with semantic priority per intent kind:
   - cta -> `cta|footer_cta|hero`
   - headline -> `hero|primary_section|intro`
   - card -> `card_grid|feature_list|secondary_section`
   - section -> `primary_section|hero|intro`
   - accent -> `cta|hero|footer_cta`
3. Fallback order: semantic -> structural(slot) -> safe heuristic.

## Structure-guided composition
- Strategy chosen by section presence: `hero_centered`, `cta_centered`, `cards_centered`, `primary_section_balanced`.
- Vague profile requests stay focused to semantic core regions, avoiding over-global edits.

## Partial-target triage
- If only subset resolves, preserve semantic precision on resolved targets.
- Emit semantic partial telemetry instead of dropping to generic section-wide fallback.

## Semantic coherence
- Evaluate whether final ops land on intended semantic regions.
- Penalize missing intent-critical regions and over-mutation for vague prompts.
