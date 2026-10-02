# Decorate quality tuning notes

## History-aware shaping
- Use `decorate_history_context_built` to verify confidence and bias kinds.
- If high undo/stale pattern repeats, tune `avoidRepeatingWeakChanges` and stability preference.

## Server shaping signals
- `decorate_server_payload_shaped` with `includedShapingKinds` lacking `shaped_context` means shaping not flowing through.
- Low satisfaction + high history confidence suggests server prompt shaping improvements.

## Fallback shaping signals
- `decorate_fallback_shaped` + repeated low quality indicates deterministic rule tuning needed.
- Frequent `avoid_recent_user_edit_conflict` without quality gain can require narrower avoid regions.

## Outcome learning interpretation
- `decorate_outcome_learning_signal` is conservative behavior-only proxy.
- `applied=true` and `undoneAfterApply=false` is positive.
- `applied=true` then `undoneAfterApply=true` is low-satisfaction hint.
- `abandonedPreview=true` / `replacedByNewerDecorate=true` points to preview relevance gap.
- `staleInvalidated=true` indicates workflow interference.

## Cache satisfaction policy
- `decorate_preview_cache_satisfaction_gate`:
  - positive proxy => friendlier TTL.
  - negative proxy / stale invalidation => short TTL or skip.

## Composed style debugging guide
- Button/title/card/section style path:
  1) verify `decorate_style_intent_composed` and `decorate_style_profile_normalized`.
  2) verify `decorate_style_composition_built` includes expected `opKinds` (`set_button_style`, `set_text_emphasis`, `set_card_style`, `set_section_style`).
  3) verify `decorate_contrast_guard_evaluated` score and warning list.
  4) if warning exists, ensure `decorate_contrast_guard_adjusted` fired and summary copy reflects actual ops.
- Vague style prompts should map to deterministic profile-driven composition in fallback as well (`decorate_style_fallback_composed` path via deterministic plan source).

## 2026-03 quality tuning guide (composed style)
1. Validate target mapping first:
   - check `decorate_style_targets_resolved` for unresolved kinds and low confidences.
2. Validate composition refinement:
   - check `decorate_style_composition_refined` for dropped noisy duplicates and capped op count.
3. Validate readability safety:
   - inspect `decorate_legibility_guard_evaluated/adjusted/warning` and ensure button/headline/surface contrast corrections were applied.
4. Validate composed intent match:
   - inspect `decorate_composed_intent_match_evaluated` and triage `missingKinds`/`penalties`.
5. Validate honest summary:
   - ensure `decorate_summary_built.majorOpKinds` and `summaryStyle` agree with actual applied ops.
6. Partial-target fallback debugging:
   - use `decorate_style_fallback_partial_target_used` and `decorate_style_fallback_degraded_target` to confirm partial success was used instead of `slot_not_found` hard fail.

## Semantic coherence tuning
- Check `decorate_semantic_sections_detected` first; poor section detection will cascade into weak targeting.
- Use `decorate_style_targets_resolved.semanticCoverageScore` + `provenanceKinds` to verify semantic-first routing is actually used.
- Validate `decorate_structure_guided_composition_built.compositionStrategy` against page anatomy (hero/cta/cards).
- Prefer semantic partial success (`decorate_semantic_partial_target_used`) over generic global fallback.
- Include `decorate_semantic_coherence_evaluated.score` in candidate triage:
  - Low score with high contrast/intent match often indicates wrong region targeted.
