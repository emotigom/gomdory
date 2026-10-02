# Decorate Reliability Playbook

## Core principle
Quality logic (history-aware shaping, enrich, scoring, candidate comparison) must never block first-click reliability to preview-ready.

## Reliability-first controls
- first-click SLA guard with hard checkpoints
- degraded mode selector (`normal`, `degraded_light`, `degraded_strict`)
- opportunistic prewarm only (never hard dependency)
- shaping/history reliability budget with downgrade path
- base readiness race tolerance
- fast rebase before final stale blocking

## Operational checklist
- Verify SLA breach/recovery signals under synthetic latency.
- Verify degraded mode entry under slow kickoff/hydration instability.
- Verify preview-ready remains reachable under degraded mode.
- Verify commit barrier and interference guards unchanged.
- Verify fast rebase only for minor drift; user-edit drift still blocks.

## Privacy/telemetry rule
Do not log raw prompts, credentials, join tokens, or sensitive user text; telemetry must remain metadata-only.

## Background/color triage (style-first)
1. Confirm `decorate_style_intent_classified` emits `background_color`, `background_gradient`, or `surface_tone`.
2. If server `/api/v1/edu/decorate/plan` fails (500/timeout), verify deterministic path emits `decorate_background_fallback_selected` with surface target.
3. Ensure no `decorate_slot_resolve` h1/text-only winner for pure background prompts; blocked cases should emit `decorate_slot_resolve_blocked`.
4. Check `decorate_plan_validation` / `decorate_preview_quality` / `decorate_intent_match_evaluated` for intent mismatch flags when output is html-only or callout-only.
5. Confirm `decorate_summary_built` aligns with actual chosen ops; do not show background copy for html-only/callout-only mutations.
