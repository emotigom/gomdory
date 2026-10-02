# Decorate telemetry sequence reference

## Transaction lifecycle (server-first, one-click)
1. `decorate_eager_prep_started`
2. `decorate_eager_prep_reused` / `decorate_eager_prep_stale` / `decorate_eager_prep_refreshed`
3. `decorate_eager_prep_completed`
4. `decorate_transaction_started`
5. `decorate_phase_transition` (`starting`)
6. `decorate_phase_transition` (`server_kickoff`)
7. `decorate_intent_routed`
8. `decorate_server_payload_built`
9. `decorate_plan_source`
10. `decorate_plan_validation`
11. `decorate_phase_transition` (`building_preview`)
12. `decorate_preview_quality`
13. `decorate_preview_handoff_ready`
14. `decorate_preview_ready`
15. `decorate_phase_transition` (`preview_ready`)

## First-click fallback path (deterministic)
1. `decorate_transaction_started`
2. `decorate_phase_transition` (`server_kickoff`)
3. `decorate_phase_transition` (`fallback_kickoff`)
4. `decorate_phase_transition` (`building_preview`)
5. `decorate_preview_handoff_ready`
6. `decorate_preview_ready` (`mode=deterministic`)

## Apply + commit barrier path
1. `decorate_preview_handoff_rechecked`
2. (`optional`) `decorate_preview_handoff_blocked`
3. `decorate_apply_consistency_check`
4. `decorate_apply_commit`
5. `decorate_commit_barrier_started`
6. `decorate_interference_guard_window_started`
7. `decorate_phase_transition` (`completed_stabilizing`)
8. `decorate_commit_barrier_completed`
9. `decorate_interference_guard_window_ended`
10. `decorate_phase_transition` (`completed`)

## Lifecycle interference rules telemetry
1. `decorate_lifecycle_resync_observed`
2. `decorate_lifecycle_interference_blocked` (for `preview_ready`/`applying`/`completed_stabilizing`)

## UI interference blocked sequence
1. `decorate_ui_interference_blocked`
2. `decorate_post_commit_interference_blocked`
3. `decorate_commit_barrier_blocked_interference`

## Progress copy telemetry
- `decorate_progress_copy_changed`
  - `requestId`
  - `from`
  - `to`
  - `phase`

## Forbidden UX patterns (must remain absent)
- Retry-required copy (`"다시 시도하면 바로 적용"` 류).
- Interstitial gate before transaction start.
- Local/WebLLM status overriding active decorate transaction status.
- Helper/generator/onboarding prominence stealing status after commit.


## History-aware quality path
1. `decorate_history_context_built`
2. `decorate_plan_shaped`
3. (`optional`) `decorate_user_edit_conflict_avoided`
4. (`optional`) `decorate_user_edit_conflict_override`
5. `decorate_server_payload_shaped`
6. (`optional`) `decorate_fallback_shaped`
7. `decorate_outcome_learning_signal`
8. `decorate_preview_cache_satisfaction_gate`

Interpretation hints:
- High `historyConfidence` + negative learning signal → tune server shaping first.
- Deterministic/fallback dominant + negative learning signal → tune fallback shaping rules.
- Repeated stale invalidation + negative cache gate → reduce TTL and tighten conflict avoidance.

## Reliability-first sequence additions

### First-click SLA
1. `decorate_sla_started`
2. `decorate_sla_checkpoint` (`transaction_visible`)
3. `decorate_sla_checkpoint` (`kickoff_visible`) or `decorate_sla_breached`
4. `decorate_sla_checkpoint` (`preview_or_fallback_visible`) or stronger breach path
5. `decorate_sla_checkpoint` (`no_hung_state`)
6. optional `decorate_sla_recovered` after breach recovery

### Degraded mode + budget
1. `decorate_degraded_mode_reasoned`
2. `decorate_degraded_mode_entered` / `decorate_degraded_mode_exited`
3. `decorate_reliability_budget_started`
4. optional `decorate_reliability_budget_exceeded`
5. optional `decorate_reliability_budget_downgraded`

### Prewarm
1. `decorate_prewarm_started`
2. `decorate_prewarm_completed` or `decorate_prewarm_skipped`
3. optional `decorate_prewarm_stale` on superseded runs

### Base readiness race
1. `decorate_base_readiness_pending`
2. `decorate_base_readiness_resolved`
3. optional `decorate_base_readiness_fallback_used`

### Fast rebase
1. `decorate_fast_rebase_attempted`
2. `decorate_fast_rebase_succeeded` or `decorate_fast_rebase_blocked`

## Style-first background intent path
- `decorate_style_intent_classified`
- `decorate_slot_resolve_blocked` (when background intent blocks text-slot resolver)
- `decorate_html_mutation_blocked_for_intent` (when generic html mutation path is blocked)
- `decorate_surface_target_resolved`
- `decorate_background_fallback_selected`
- `decorate_intent_match_evaluated`
- `decorate_summary_built`
- `decorate_candidate_comparison` (extended with `intentMatchScore`, `surfaceStyleScore`, `htmlOnlyPenalty`, `chosenReason`)

Background-color/gradient requests should produce surface/background style mutations (`set_surface_background`) and be treated as intent mismatch when only html/callout mutation is present.

## Composed style telemetry additions
- `decorate_style_intent_composed`
  - `requestId`, `primaryStyleIntent`, `secondaryStyleIntents`, `compositionHints`, `confidence`
- `decorate_style_profile_normalized`
  - `requestId`, `profile`, `sourceIntent`, `confidence`
- `decorate_style_composition_built`
  - `requestId`, `opKinds`, `targetKinds`, `strength`, `styleProfile`
- `decorate_contrast_guard_evaluated`
  - `requestId`, `score`, `contrastWarnings`
- `decorate_contrast_guard_adjusted`
  - `requestId`, `adjustmentsApplied`
- `decorate_candidate_comparison` extended fields
  - `styleIntentMatchScore`, `surfaceCoverageScore`, `accentCoverageScore`, `contrastSafetyScore`, `htmlMutationPenalty`, `overMutationPenalty`
- `decorate_summary_built` payload extension
  - `styleProfile`, `opKinds`, `summaryKind`, `intentMatched`

## 2026-03 composed quality telemetry additions
- `decorate_style_targets_resolved`
  - `requestId`, `targetKinds`, `resolvedCount`, `unresolvedKinds`, `confidences`
- `decorate_style_composition_refined`
  - `requestId`, `originalOpCount`, `finalOpCount`, `droppedKinds`, `refinedReasons`
- `decorate_legibility_guard_warning`
  - `requestId`, `warnings`
- `decorate_composed_intent_match_evaluated`
  - `requestId`, `primaryStyleIntent`, `matchScore`, `matchKinds`, `missingKinds`, `penalties`
- `decorate_style_fallback_partial_target_used`
- `decorate_style_fallback_refined`
- `decorate_style_fallback_degraded_target`
- `decorate_candidate_comparison` payload extension
  - `targetCoverageScore`, `legibilityScore`, `styleCoherenceScore`, `emphasisPrecisionScore`, `saturationPenalty`, `noisyCompositionPenalty`
- `decorate_summary_built` payload extension
  - `majorOpKinds`, `summaryStyle`, `multiOp`, `intentMatched`

## Semantic layout-aware telemetry additions
- `decorate_semantic_sections_detected`
  - `requestId`, `sectionKinds`, `primarySectionKind`, `hasHero`, `hasCTA`, `hasCards`, `count`
- `decorate_style_targets_resolved` payload extension
  - `semanticKindsUsed`, `provenanceKinds`, `semanticCoverageScore`
- `decorate_structure_guided_composition_built`
  - `requestId`, `semanticKindsUsed`, `opKinds`, `targetKinds`, `compositionStrategy`
- `decorate_semantic_partial_target_used`
  - `requestId`, `requestedKinds`, `resolvedKinds`, `missingKinds`, `strategy`
- `decorate_style_profile_semantic_applied`
  - `requestId`, `profile`, `semanticKinds`, `majorTargets`
- `decorate_semantic_coherence_evaluated`
  - `requestId`, `score`, `matchedSemanticKinds`, `missingSemanticKinds`, `penalties`
- `decorate_summary_built` payload extension
  - `semanticKindsMentioned`, `summaryAudienceStyle`, `multiSection`
