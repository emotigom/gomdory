# Routing Contract: Student Share Flow

## Scope

- One Cloudflare Worker named gom-clean serves both domains.
- The short student domain is gkrry.com and must not be treated as a separate worker.
- The teacher and canonical student domain is gomdory.com.

## Entry Flow (short host)

- When the request host is gkrry.com, www.gkrry.com, or eduview.gkrry.com and the path is root:
  - The request is rewritten internally to the student entry page at the share entry route.
  - The visible URL stays on the short host.
- Requests that begin with the share entry route are allowed on the short host without redirect.
- Other paths may redirect to the canonical teacher host when they are sensitive.

## Entry UI contract

- The share entry page exposes a stable marker by setting the data-page-marker attribute to share-entry.
- The entry UI must display errors in the same layout as the normal entry flow.

## Student board contract

- The canonical share-board path is `/s/[code]`; classroom QR/share URLs should prefer `https://www.gkrry.com/s/[code]` and may redirect/resolve through the shared worker to guest student mode.
- `/s/[code]` resolves boards by the persisted `boards.share_code` value. Incoming codes are accepted case-insensitively and normalized internally before lookup; public route access must not regenerate or rotate codes.
- QR scan and manual `www.gkrry.com` code entry land in the same modern guest board surface. The surface uses the current dark HUD board language while keeping guests as restricted viewers/contributors, not owners.
- A successful student board render exposes a stable marker by setting the data-page-marker attribute to student-board.
- Error renders expose a stable marker by setting the data-page-marker attribute to student-board-error.

## Navigation contract

- Entry form submission routes to the student board using a relative path to the share route.
- Client navigation must not hardcode the canonical domain.

## Board QR / access-code contract

- Any authenticated viewer who can open the canonical dashboard board may open the QR/share UI.
- QR/share/code entrants resolve through `/s/[code]` as guests unless they separately navigate as the authenticated owner in dashboard.
- Guests may read and contribute only according to board/wall write and upload permissions; they cannot change board settings, delete the board, rotate the persistent code, delete owner-created content, or perform destructive owner-only actions.
- The six-character access code is the persisted `boards.share_code`; it is generated only when missing, remains stable until owner rotation/change or board deletion, and can be entered from `www.gkrry.com`.

## Smoke checks

- The post deploy smoke script verifies:
  - The short origin root returns the share entry marker.
  - The teacher origin share route returns the student board marker.

## Teacher dashboard board contract

- Canonical teacher board route: `/dashboard/boards/[boardId]/board`.
- Canonical runtime owner: `app/dashboard/boards/[boardId]/board/TeacherBoardCanonicalClient.tsx`.
- Canonical smoke marker: `data-board-runtime="teacher-board-canonical"`.
- Common teacher/dashboard board entrypoints must use `boardBoardHref(...)`.
- Legacy teacher board routes (`/dashboard/boards/[boardId]`, `/class`, `/grid`) must redirect or delegate to `/board` unless separately documented as non-default surfaces.
- Canonical route must not silently fall back to legacy runtime surfaces (e.g. `TeacherBoardMinimalClient`, `WallColumn`-centric runtime).

## Canonical board entrypoint reminder

- Canonical teacher entrypoint remains `/dashboard/boards/[boardId]/board`.
- `/class` and `/grid` are redirect-only compatibility surfaces to `/board` unless explicitly documented otherwise.
- Board links in dashboard surfaces must keep using `boardBoardHref(...)` instead of `/class`/`/grid` defaults.

- Settings/edit companion route: `/dashboard/boards/[boardId]/edit`.
- Settings route should link users back to canonical board route `/dashboard/boards/[boardId]/board` and must not promote `/class` or `/grid`.

## Public asset URL contract

- Frontend URLs must use R2 custom domains only: `assets.gomdory.com` for public UI assets, `models.gomdory.com` for WebLLM/model assets, and `eduview.gkrry.com` for published education project views.
- R2 bucket names such as `gom-public-assets`, `edu-webllm-models`, `gom`, or `gom-edu-projects` are deployment internals and must not be used in public frontend URLs.

## Lesson practice activity contract

- Teacher-facing launch entrypoint lives on the canonical owner board route `/dashboard/boards/[boardId]/board` and must remain inside `TeacherBoardCanonicalClient` rather than `/class` or `/grid` compatibility routes.
- Teachers can start/end one minimal active lesson session from the canonical board. The selected lesson template is stored on the existing `class_sessions` row and `boards.active_session_id` points at the active row.
- Students continue to enter through `/s/[code]` using the persisted board share code. Active lesson panels must not create a new public route, rotate codes, or broaden guest permissions.
- `/s/[code]` may render a guest-safe `오늘의 실습` panel for the active lesson. Lesson 1 renders AI Bingo Arena; lesson 2 remains placeholder-only for AI Judgment Sort/Web Studio. Guests must not receive teacher controls or mutation affordances for lesson sessions.
- AI Bingo progress uses the existing share route and `student_activity_states` rows keyed by `activity_run_id + participant_key_hash`; this does not add routes, rotate share codes, or broaden guest permissions.
- The current runtime intentionally excludes Judgment Sort logic, Web Studio, scoring dashboards, and real-time push.

## Student activity state API

- `GET /api/v1/share/[code]/activity-state` resolves the same public share code used by `/s/[code]`, then returns/creates only the current participant's AI Bingo state for the active board activity.
- `PATCH /api/v1/share/[code]/activity-state` updates one selected AI Bingo tile reason for the current participant key. The API validates the participant key, share-code board, active activity run, tile membership, reason length, and the participant hash so guests only mutate their own state.
- The teacher summary is rendered only from the authenticated dashboard board route after normal board-role checks.
- This does not change QR/share-code generation, guest board access policy, or `/s/[code]` routing.

## Lesson Activity State Route — AI Judgment Sort

- `GET /api/v1/share/[code]/activity-state?activityType=ai_judgment_sort` resolves the existing public share code and returns/creates only the current participant's Judgment Sort state for the active board activity.
- `PATCH /api/v1/share/[code]/activity-state` with `activityType: "ai_judgment_sort"` supports `place_card`, `save_reason`, and `submit` operations. The route validates the share-code board, active activity run, participant key, card id, category id, and reason length before mutating `student_activity_states.state`.
- The route does not expose other students' individual states to guests. Teacher aggregates are loaded server-side on the canonical board and summarized before rendering.
- QR/share-code generation and `/s/[code]` routing are unchanged; Lesson 2 simply reuses the existing share route and activity-state endpoint.
