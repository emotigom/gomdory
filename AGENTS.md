# Gomdory Public Code Guide

## Authority

- This repository is the canonical home for publishable application source after cutover.
- Public CI validates code; it never authorizes production deployment.
- Production credentials, provider mutations, incident evidence, and release authority stay outside this repository.

## Workflow

- Start from current `main` and an Issue with a bounded user-visible change.
- Use short branches and focused PRs.
- Preserve unexpected work; do not reset, stash, clean, or discard unrelated changes.
- Prefer narrow deterministic tests before broader suites.
- Keep Node 20.x and the committed npm lockfile as the baseline.

## Security

- Never commit production secrets, private keys, access tokens, signed URLs, or credential-bearing connection strings.
- Only public/publishable configuration belongs in tracked examples.
- Treat server/admin configuration as external runtime input.
- Security-sensitive changes need explicit Issue scope and review.

## Deployment boundary

- No workflow in this repository deploys to production.
- A passing Public CI run produces an immutable source SHA only.
- Private operations may later promote an exact reviewed Public SHA under separate authority.
