# Test runner quick guide

검사 범위는 `AGENTS.md`와 현재 Issue의 변경 경계로 정합니다. 실패한 guard/contract의 메시지와 해당 코드·테스트를 확인한 뒤, 아래의 관련 명령으로 재검증합니다. 전체 `validate:seams` 실행은 관련 경계가 함께 변경된 경우에 선택합니다.

## Boundary validation map

Use `npm run test:node -- --match <comma-separated-patterns>` for fast seam-focused checks. `scripts/run-tests.mjs` now supports `--match` directly, so the command examples below work as written. Guard failures for the major seams now follow the same pattern: seam name → source of truth → `npm run validate:seams` → seam-specific fast commands.

| Boundary / seam                    | Authoritative source(s) | Why it exists                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Fast command                                                                                                                                                                          | Key tests / guards                                                                                                                                                                                                                                                                                                                |
| ---------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Env / deploy / smoke               | `docs/DEPLOY_CLOUDFLARE.md`, `docs/SSOT_ENV.md`, `docs/OPS_RUNBOOK.md` | Protect env SSOT, Cloudflare placement, and operator smoke prerequisites.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `npm run ssot:check && npm run smoke:env:check && npm run check:build-env`                                                                                                            | `scripts/ssot/check.mjs`, `scripts/smoke/check-smoke-env.mjs`, `scripts/check-build-env.mjs`                                                                                                                                                                                                                                    |
| Ops / runtime surface              | `docs/OPS_RUNTIME_SURFACE.md`, `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md`, `docs/DEVELOPER_ARCHITECTURE_GUIDE.md`, `tests/README.md` | Keep route-adjacent server helpers and ops-facing routes behavior-preserving. `tests/ops-runtime-boundary.guard.test.ts` is the fastest source-of-truth check when request-context plumbing or route delegation ownership drifts; use it first before widening to the import guardrail sweep. The import guardrail also blocks new `@/lib/ops/requestContext` usage so the compatibility shim does not spread, freezes new generic `@/lib/ops/withOps` imports unless they are explicitly grandfathered, and `tests/request-context-ownership.guard.test.ts` verifies that shared request-aware route envelope logic stays owned by `lib/api/server/operationalRoute.ts` rather than growing back inside `lib/ops/withOps.ts`. For the remaining non-ops `withOps` exceptions, use `lib/ops/withOpsGrandfathered.ts` as the per-route category/disposition/reason/prerequisite registry instead of inferring precedent from the route files themselves. Treat `candidate-after-proof` entries as hold-first until the listed focused route proof exists. | `npm run test:guards -- --match ops-runtime-boundary,request-context-ownership && npm run test:node -- --match requestContext,withOps,system-diag`                                    | `tests/ops-runtime-boundary.guard.test.ts`, `tests/request-context-ownership.guard.test.ts`, `tests/requestContext.test.ts`, `tests/withOps.test.ts`, `tests/system-diag-edu-publish-fields.test.ts`, `tests/import-boundary-guardrails.guard.test.ts`                                                                            |
| Student execution                  | `docs/DEVELOPER_ARCHITECTURE_GUIDE.md`, `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md`, `tests/README.md` | Protect ChatPanel → orchestration → dispatch/provider ownership plus shared request-id/retry semantics. Start with the boundary guard when delegation drift is suspected, then widen to the focused node tests.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `npm run test:guards -- --match student-execution-boundary && npm run test:node -- --match student-execution,student-coach,student-chat-panel-orchestration,decorate-student-surface` | `tests/student-execution-boundary.guard.test.ts`, `tests/student-execution-semantics.test.ts`, `tests/student-coach-dispatch.test.ts`, `tests/student-chat-panel-orchestration.test.ts`, `tests/student-coach-surface.test.ts`, `tests/decorate-student-surface.test.ts`, `tests/student-execution-provider-availability.test.ts` |
| Public share / public-entry        | `docs/OPS_RUNTIME_SURFACE.md`, `docs/DEVELOPER_ARCHITECTURE_GUIDE.md`, `docs/REPO_BOUNDARY_OWNERSHIP_2026Q1.md`, `tests/README.md` | Keep shared access guards, route markers, and centralized public-entry access ownership stable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `npm run check:route-invariants && npm run test:guards -- --match public-share-boundary && npm run test:node -- --match public-share-access,public-share-boundary,onboarding-demo.route` | `tests/public-share-access.test.ts`, `tests/public-share-boundary.guard.test.ts`, `scripts/guard/route-invariants.mjs`                                                                                                                                                                                                            |

## Useful runner options

- `npm run test:node -- --match student-coach-dispatch`
- `npm run test:guards -- --match env-proxy-alias-boundary`
- `node scripts/run-tests.mjs --list --match student`

## JT lesson entry E2E

- Test file: `tests/lesson-list-jt-entry.playwright.test.mjs`
- 목적: 실제 학생 진입 링크(`/edu/lesson?jt=...`)가 열리고, 교시 목록 구조/상호작용/이동이 유지되는지 브라우저에서 검증합니다.

### Environment variables

다음 중 한 가지 방식으로 실행합니다.

1. **완성 URL 제공**

- `E2E_LESSON_ENTRY_JT_URL`

2. **base + token 조합**

- `E2E_BASE_URL`
- `E2E_LESSON_ENTRY_JT`

예시:

```bash
E2E_LESSON_ENTRY_JT_URL="https://preview.example.com/edu/lesson?jt=***" node --test tests/lesson-list-jt-entry.playwright.test.mjs
```

```bash
E2E_BASE_URL="https://preview.example.com" E2E_LESSON_ENTRY_JT="***" node --test tests/lesson-list-jt-entry.playwright.test.mjs
```

> 토큰은 절대 하드코딩하지 말고, CI secret 또는 로컬 환경 변수로만 주입하세요.

### Skip conditions

- `E2E_LESSON_ENTRY_JT_URL` 미설정이고 `E2E_BASE_URL + E2E_LESSON_ENTRY_JT` 조합도 없으면 skip.
- `playwright` 패키지가 없는 환경이면 skip.

### 배포 환경 시나리오 커버

1. jt lesson entry page opens
2. ordered core lessons first (1→4)
3. free mode separated below
4. click lesson card navigates correctly
5. click free mode navigates correctly
6. entry cue visible without blocking navigation
7. mobile viewport order 유지
8. a11y-friendly selectors 기반 탐색

## Existing runner limitation

`tests/inferSlotFromText.test.ts` remains the existing unsupported runner case: its `node:test` `mock.module` hook cannot intercept the dependency after esbuild inlines it. The manifest records this limitation explicitly; it is not a passing or executed test. No new exclusion is introduced by the context cleanup.
