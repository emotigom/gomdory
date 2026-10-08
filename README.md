# Gomdory

Gomdory is a teacher-led classroom platform for collaborative boards, Courseware activities, and student-created projects.

This repository is the clean public source home for publishable application code. Production credentials, incident evidence, private operations history, and the private courseware/media overlay are intentionally kept outside this repository.

## Local development

Use Node 22.x and npm.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Tracked environment examples contain public/test placeholders only. Never commit production server secrets.

## Source layout

- `app/` — Next.js App Router application
- `components/` — reusable UI components
- `lib/` — domain and server/client libraries
- `types/` — shared type contracts
- `worker/` — publishable Worker-side source
- `tests/` — public-safe unit and guard tests
- `supabase/migrations/` — current successor baseline used for schema review and local reproducibility

The initial public snapshot excludes private lesson-kit/media content and historical migration/operations evidence. See [PUBLIC_PROVENANCE.md](PUBLIC_PROVENANCE.md).

## Verification

Useful local gates include:

```sh
npm run lint
npm run check:route-invariants
npm run typecheck
npm run test:public
npm run build:opennext:public
```

Public CI performs build and review checks only. It does not deploy to production.

## Source availability and license

This repository is public for source review and technical evaluation, but it is **not open source**. The Gomdory-owned source is published without an open-source license and remains all-rights-reserved unless separate written permission applies.

See [SOURCE_USE_POLICY.md](SOURCE_USE_POLICY.md) for the repository's source-use boundary. Third-party packages remain governed by their own licenses.

## Security

Please report vulnerabilities through the private process described in [SECURITY.md](SECURITY.md). Do not place credentials, private user data, or exploitable details in public Issues.

## Production boundary

A passing public CI run produces a reviewable source commit. Production promotion, provider credentials, database operations, and incident response are handled through separate private operational authority.
