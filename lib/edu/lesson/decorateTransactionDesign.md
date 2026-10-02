# decorate transaction design

## Goal
Make decorate a server-first, one-click transaction independent from WebLLM/load UI, and guarantee users reach committed state without post-commit status shake.

## State machine
- `idle`
- `starting`
- `server_kickoff`
- `fallback_kickoff`
- `building_preview`
- `preview_ready`
- `applying`
- `completed_stabilizing`
- `completed`
- `blocked`
- `error`

`requestId` is created at click time and preserved through preview/apply.

## Commit barrier + stabilization window (must keep)
- After successful apply commit, controller enters `completed_stabilizing` and opens a short barrier window.
- During barrier window, helper/generator/lifecycle/background interference must not override committed decorate status.
- Barrier events:
  - `decorate_commit_barrier_started`
  - `decorate_commit_barrier_blocked_interference`
  - `decorate_commit_barrier_completed`
- Interference guard window events:
  - `decorate_interference_guard_window_started`
  - `decorate_post_commit_interference_blocked`
  - `decorate_interference_guard_window_ended`

## Preview handoff object (preview_ready contract)
Pending preview is treated as a handoff-ready object, not a raw blob.
Required fields:
- `requestId`
- `source`
- `createdAt`
- `baseSnapshotVersion`
- `baseHtmlHash`
- `previewHash`
- `qualityScore`
- `outcomeHint`
- `invalidationRisk`
- `applyEligibility`

Apply must recheck handoff eligibility immediately before commit.

## Ownership + lifecycle rules
- Controller owns orchestration and phase transitions.
- ChatPanel renders and emits telemetry.
- WebLLM state is auxiliary and cannot mutate transaction phase.
- Lifecycle events (`initial/hydrate/visibility/focus/pageshow/rebind`) are passive observe while active transaction exists.
- In `preview_ready`, `applying`, and `completed_stabilizing`, lifecycle refresh attempts are suppressed and logged.

## Priority rules
1. Active decorate transaction phase/status (including stabilization window).
2. Preview/apply availability.
3. Passive local AI/WebLLM status.

## Forbidden UX patterns
- Retry-required copy (e.g. “다시 시도하면 바로 적용…”).
- Blocking interstitial before first-click transaction start.
- Local/WebLLM/helper status overriding active decorate transaction status.
- Helper/onboarding/generator UI taking primary status immediately after commit.

## E2E verification checklist
- First lesson entry → first click starts transaction without interstitial.
- Preview ready → apply → committed + stabilization preserved.
- Slow kickoff path reaches deterministic preview.
- WebLLM loading/banner present but decorate status remains primary.
- Preview stale invalidates correctly after user edit.
- Post-commit helper/generator interference is blocked.
- Refresh/tab-restore followed by first click still starts one-click transaction.

## Reliability Hardening (First-click SLA)

- First-click decorate now runs under an explicit SLA guard.
  - `T+0~150ms`: transaction visible (`starting`).
  - `T+1s`: server kickoff or fallback kickoff visible.
  - `T+3~5s`: preview-ready or explicit degraded path visible.
  - `T+6s`: no hung-looking state is allowed.
- SLA guard emits `decorate_sla_started/checkpoint/breached/recovered` and can trigger stronger degraded phase transitions for the active `requestId` only.
- Obsolete/canceled request timers are always stopped to avoid stale side effects.

## Degraded Mode Rules

- Runtime degraded decision: `normal | degraded_light | degraded_strict`.
- Inputs include kickoff delay, preview build delay, snapshot/hash readiness, hydration stability, recent SLA breaches, and network-timeout signals.
- In degraded mode, reliability-first policy applies:
  - skip non-essential shaping/history work,
  - prefer deterministic fallback and minimal preview plan,
  - preserve transaction semantics and commit/apply consistency.

## Reliability Budget Rules

- Shaping/history/quality logic gets a strict lightweight execution budget.
- If budget is exceeded, pipeline downgrades to reliability-first behavior:
  - minimal shaping only or shaping skip,
  - deterministic defaults,
  - no extra blocking enrich/comparison steps before preview-ready.
- Principle: quality logic must not block first preview-ready.

## Base Readiness Race Handling

- First-click transaction can start even when hydration/snapshot/hash readiness is pending.
- Base readiness telemetry tracks pending/resolved/fallback-used states.
- If readiness is late under degraded pressure, deterministic fallback remains available without breaking apply consistency barriers.

## Fast Rebase Policy

- Apply handoff recheck remains mandatory.
- On minor base drift, fast rebase may refresh eligibility and continue apply.
- On major/user-edit drift, apply remains blocked.
- Fast rebase outcomes are recorded for reliability/outcome analysis.

## Degraded E2E Checklist

- happy path first-click preview-ready/apply,
- slow kickoff timeout/fallback path,
- hydration race path,
- post-apply interference guard,
- user edit before apply stale-or-fast-rebase path,
- forbidden UX checks (retry-required copy / interstitial gate / local WebLLM prominence during active decorate).
