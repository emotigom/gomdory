# Developer architecture guide

This is the **practical contributor map** for the repo seams clarified across PR #2052–#2060. Read this when you need to decide **where new code belongs**, **which boundaries are intentionally guarded**, and **which code contracts apply**.

For deeper detail, follow the linked SSOT docs instead of inferring intent from PR history.

## Start here: the five seams that matter

| If you are changing...                                    | Primary owner                                                            | Supporting SSOT / helpers                                                                                                                                                                      |
| --------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env keys, runtime env parsing, deploy/smoke prerequisites | `lib/env/**`, `lib/server/runtimeEnv.ts`, `scripts/ssot/**`              | `docs/SSOT_ENV.md`, `docs/DEPLOY_CLOUDFLARE.md`, `docs/OPS_RUNBOOK.md`                                                                                                                         |
| Route-adjacent server-only response/ops/diag helpers      | `lib/api/server/**`, `lib/ops/**`, `lib/system/diag/**`, `lib/e2e/**`    | `docs/OPS_RUNTIME_SURFACE.md`, `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md`                                                                                                                        |
| Student decorate / coach execution orchestration          | `lib/edu/lesson/**` with `app/edu/_components/ChatPanel.tsx` as UI entry | `studentChatPanelOrchestration.ts`, `studentDecorateExecution.ts`, `studentCoachExecution.ts`, `studentExecutionSemantics.ts`, `studentExecutionProviderAvailability.ts`, `runDecorateFlow.ts` |
| Public share / public-entry board and wall access         | `lib/share/**` plus thin `app/s/**` and `app/api/v1/share/**` routes     | `docs/OPS_RUNTIME_SURFACE.md`, `docs/routing-guardrails.md`                                                                                                                                    |
| Repo placement / server-only ownership decisions          | feature folder first, `lib/server/**` only for generic server adapters   | `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md`                                                                                                                                                       |

## 1) Where code should go

### Env / config / deploy / smoke

Use these owners when the change is about env names, env parsing, or deploy/smoke validation.

- **Env inventory / validation rules:** `scripts/ssot/**`, `lib/env/**`
- **Runtime env reads inside app code:** `lib/server/runtimeEnv.ts`
- **Human operator reference:** `docs/SSOT_ENV.md`
- **Cloudflare placement / predeploy flow:** `docs/DEPLOY_CLOUDFLARE.md`
- **Incident and operator procedure:** `docs/OPS_RUNBOOK.md`

Practical rule:

- If you are introducing or renaming an env key, update the inventory/check path first and then update the mirror docs.
- Treat `EDU_OPENAI_PROXY_*` as the canonical backend-proxy vocabulary in operator/contributor docs. Keep the exact legacy backend-proxy alias spellings confined to `docs/SSOT_ENV.md`, `scripts/ssot/env.inventory.json`, and the runtime-fallback guard/tests that explicitly track them.
- Do **not** add raw `process.env.FOO` reads inside route files when `readEnvString` / `getRuntimeEnv` already covers the use case.

### Route-adjacent server-only helpers

Use these folders when logic exists because routes, smoke, diag, or operator flows need a reusable server-side seam.

- `lib/api/server/**` → request-id-aware JSON envelopes, canonical request-context plumbing, no-store response helpers, response plumbing, shared operational route response shaping
- `lib/ops/**` → health/smoke/operator runtime helpers plus ops-specific structured logging such as `lib/ops/logWithContext.ts`
- `lib/system/diag/**` → `/api/v1/system/diag` payload assembly
- `lib/e2e/**` → smoke/e2e auth helpers
- `lib/share/**` → public-entry/share resolution and write guards

Practical rule:

- Keep `app/api/**` handlers thin: parse request, call helper, return response.
- If a helper is route/server infrastructure, mark and treat it as **server-only**, not as a generic utility.

### Student execution orchestration

The current seam is intentionally split so contributors do not have to rediscover ChatPanel behavior from a single large component.

- `app/edu/_components/ChatPanel.tsx` owns the UI surface and event wiring.
- `lib/edu/lesson/studentChatPanelOrchestration.ts` owns action-plan creation and telemetry bundling for student decorate/coach dispatch.
- `lib/edu/lesson/studentDecorateExecution.ts` and `studentCoachExecution.ts` own dispatch decisions.
- `lib/edu/lesson/studentExecutionSemantics.ts` owns shared dispatch semantics such as request-id ownership and retry mode.
- `lib/edu/lesson/studentExecutionProviderAvailability.ts` owns provider/fallback-adjacent availability glue used before execution starts.
- `lib/edu/lesson/runDecorateFlow.ts` owns the actual decorate pipeline once execution starts.

Practical rule:

- If the change is about **whether** student execution should start, block, retry, or emit telemetry, start in the orchestration / execution-semantics helpers.
- If the change is about **provider readiness / fallback-adjacent availability before execution starts**, start in `studentExecutionProviderAvailability.ts`.
- If the change is about **how decorate generation runs after dispatch**, start in `runDecorateFlow.ts` and its supporting decorate pipeline helpers.

### Public share / public-entry boundaries

Use this seam for code that decides whether public users can resolve a board/wall or write into it.

- Root `lib/share/*.ts` files own generic share helpers such as share-code normalization, viewer-name normalization, and URL builders.
- `lib/share/public/access.ts` owns server-only public-entry board/wall resolution plus write guards.
- `app/s/**` owns public pages.
- `app/api/v1/share/**` owns thin API handlers that delegate to `lib/share/**`.
- `docs/routing-guardrails.md` explains host/domain expectations.

Practical rule:

- Do not re-implement ended-class checks, write-enabled checks, or board/wall resolution ad hoc in each route.
- Reuse `lib/share/public/access.ts` first when the rule is public-entry-specific; keep generic share helpers at the `lib/share/*` root.

### Repo ownership / feature placement

Use `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md` for the final placement decision.

Quick placement order:

1. Route-local only → keep it in `app/**`.
2. Reusable product/domain logic → feature folder under `lib/**`.
3. Public share/public-entry boundary → `lib/share/**`.
4. Ops/runtime/diag/smoke boundary → `lib/ops/**`, `lib/api/server/**`, or `lib/system/diag/**`.
5. Generic server adapter without a better feature owner → `lib/server/**`.
6. Repo automation, guards, codemods, smoke → `scripts/**`.

## 2) Intentionally guarded seams

These boundaries are already important enough to protect explicitly.

### Guarded today

- **Server-only route/runtime helpers** use `import "server-only"` so client code cannot casually consume them.
- **Request-id/request-context plumbing** belongs in `lib/api/server/requestContext.ts`; if you only need ops-flavored structured logs, use `lib/ops/logWithContext.ts` rather than routing plumbing back through `lib/ops/requestContext.ts`. Treat `lib/ops/requestContext.ts` as compatibility-only and avoid introducing new imports from that shim.
- **Import-choice rule for this seam:** new request plumbing imports go to `@/lib/api/server/requestContext`; shared request-aware route envelope/header shaping should start in `@/lib/api/server/operationalRoute`; new ops structured logging imports go to `@/lib/ops/logWithContext`; `@/lib/ops/requestContext` exists only to keep older imports rollback-safe, and `@/lib/ops/withOps` is the narrower ops adapter when telemetry/error reporting is part of the route contract. Treat existing non-ops `withOps` usage as grandfathered compatibility, not as the default for new generic routes.
- **Exception registry rule:** when you need to inspect or justify the remaining non-ops `withOps` imports, read `lib/ops/withOpsGrandfathered.ts` first. Its categories/dispositions/reasons/prerequisites explain which routes are response-shape-sensitive, telemetry-sensitive, or route-specific-complexity holdovers, and which ones are only `candidate-after-proof` hold candidates that still require focused route proof before moving.
- **Route env access** is restricted by lint: route/server files should use `lib/server/runtimeEnv` instead of direct `process.env` reads.
- **Student decorate internals** are guarded by lint so callers use `runDecorateFlow` instead of importing low-level decorate JSON generation directly.
- **Public-entry / smoke / diag route seams** are guarded by lint so `lib/share/public/access`, `lib/e2e/smokeAuth`, and `lib/system/diag/runtimeSummary` stay attached to their thin route owners instead of spreading as generic helpers.
- **Share-entry/student-board route markers** are protected by `npm run check:route-invariants`.
- **Repository context boundaries** are protected by `npm run check:context-boundary`.

### Do not cross these seams casually

- Do not import route/server infrastructure into client components.
- Do not put product-domain logic in `lib/ops/**` just because the first caller is an ops route.
- Do not bypass `studentChatPanelOrchestration.ts` / execution helpers when changing student decorate or coach dispatch semantics.
- Do not duplicate public share access checks inside `app/s/**` or `app/api/v1/share/**` when the shared guard belongs in `lib/share/public/access.ts`.

## 3) Focused verification

Select checks for the changed boundary under `AGENTS.md` and the current Issue. `tests/README.md` documents test groups and focused commands. Documentation changes use `npm run docs:check`; env changes use the existing environment contract checks. Deployment preparation applies only to an explicitly authorized deployment task.

## 4) Concrete examples

### Example A: adding a new smoke-safe ops JSON helper

- Route-local response formatting duplicated across two ops routes?
- Put the reusable response helper in `lib/api/server/**` or `lib/ops/**`.
- Keep each `app/api/**/route.ts` focused on request parsing + delegation.

### Example B: adjusting public student write rules

- If the rule affects multiple public share routes/pages, add it in `lib/share/public/access.ts`.
- If the rule is generic share-domain formatting/normalization instead, keep it in the `lib/share/*` root.
- Then keep route/page changes minimal and reuse the shared guard.

### Example C: changing student decorate CTA behavior

- Start in `studentChatPanelOrchestration.ts` or the student execution decision helpers.
- Only touch `ChatPanel.tsx` for UI wiring or display changes.
- Only touch `runDecorateFlow.ts` if generation behavior after dispatch truly changes.

### Example D: adding a new runtime env prerequisite

- Update `scripts/ssot/env.inventory.json` / `lib/env/**` first.
- Then update `docs/SSOT_ENV.md` and, if placement or predeploy flow changed, `docs/DEPLOY_CLOUDFLARE.md`.
- Finish by running `npm run ssot:check`.

## 5) Read this next when needed

- Architecture/doc entry point: `docs/INDEX.md`
- Env/deploy/smoke SSOT: `docs/SSOT_ENV.md`, `docs/DEPLOY_CLOUDFLARE.md`, `docs/OPS_RUNBOOK.md`
- Runtime/ops/public-entry seam: `docs/OPS_RUNTIME_SURFACE.md`
- Repo placement / server-only ownership: `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md`
- Host/domain routing rules: `docs/routing-guardrails.md`

This guide is intentionally short. If a new architectural rule matters enough to repeat often, prefer updating the owning SSOT doc and linking it here rather than growing a second manifesto.
