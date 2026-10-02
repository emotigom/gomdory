# Decorate Style Intent Design

## 목적
배경/색상 요청이 generic HTML mutation 경로로 새는 문제를 막고, server 5xx에서도 결정적(style-first) fallback을 보장한다.

## 분류
`classifyDecorateStyleIntent`는 다음 style intent를 분류한다.
- `background_color`
- `background_gradient`
- `surface_tone`
- `accent_color`
- `text_color_only`
- `none`

## 정책
- `background_*` 및 `surface_tone`은 surface-first 경로로 처리한다.
- background intent에서는 기본적으로 text slot resolver / callout insertion / html-only mutation을 금지한다.
- deterministic fallback은 `set_surface_background` op를 우선 사용한다.

## target resolution
`resolveDecorateSurfaceTarget` 우선순위:
1. hero/primary section
2. section surface
3. page surface (`main`/`body`)
4. card/group surface fallback

## 품질/검증
- `evaluateDecorateIntentMatch`로 intent-result 일치성 측정.
- background intent + html-only/callout-only는 mismatch.
- candidate comparison은 background intent에서 surface style 가중치, html-only 패널티를 적용.

## 운영 포인트
- telemetry:
  - `decorate_style_intent_classified`
  - `decorate_slot_resolve_blocked`
  - `decorate_html_mutation_blocked_for_intent`
  - `decorate_surface_target_resolved`
  - `decorate_background_fallback_selected`
  - `decorate_intent_match_evaluated`
  - `decorate_summary_built`

## 2026-03 composed style-first expansion
- Added composed taxonomy: `cta_emphasis`, `headline_emphasis`, `card_tone`, `section_tone`, `accent_emphasis`, `typography_tone`, `cute_soft_style`, `luxury_clean_style`, `playful_bright_style`.
- Classifier now returns `primaryStyleIntent`, `secondaryStyleIntents`, `compositionHints`.
- Added style profile normalization (`soft_playful`, `clean_modern`, `luxury_minimal`, `bright_friendly`, `calm_pastel`) and shared use in classifier/composition/fallback.
- Style op DSL expanded beyond background to `set_surface_tone`, `set_text_style`, `set_text_emphasis`, `set_accent_style`, `set_button_style`, `set_card_style`, `set_section_style`.
- Contrast/accessibility guard runs before preview/apply commit and auto-adjusts text/button contrast.
- Vague prompt triage: profile-first composition, then guarded op execution, without generic HTML fallback hijack for style-intent requests.

## 2026-03 composed style quality polish
- Added `resolveDecorateStyleTargets(...)` to stabilize CTA/headline/card/section/accent target mapping with confidence + priority metadata.
- Composition now consumes resolved targets and trims noisy/redundant ops for stronger style coherence.
- Added `evaluateComposedStyleIntentMatch(...)` so multi-op outcomes are scored against requested intent (matchKinds/missingKinds/penalties).
- Summary builder is multi-op aware and now prefers honest 1~2 major-op phrasing.

## Semantic targeting (layout-aware)
- Added semantic section taxonomy for lesson DOM detection:
  - `hero`, `intro`, `cta`, `feature_list`, `card_grid`, `profile`, `gallery`, `footer_cta`, `primary_section`, `secondary_section`.
- `resolveDecorateStyleTargets(...)` now consumes semantic sections and prioritizes semantic provenance before structural/heuristic fallback.
- Targets include provenance metadata (`semanticKind`, `resolverReason`, `provenance`) so downstream composition/scoring/summary can explain *where* and *why* styles were applied.
- Vague profile requests (`soft_playful`, `clean_modern`, `luxury_minimal`) now combine profile normalization + semantic regions to avoid noisy global mutation.
