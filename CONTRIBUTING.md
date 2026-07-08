# Contributing to Kestrel

Thanks for considering a contribution. Kestrel is early-stage (see `docs/roadmap.md`), which means there's a lot of room to shape real architecture, not just fix typos.

## Ground rules

- Be kind. Disagree on technical merits, not people.
- Open an issue before a large PR — saves everyone time if the direction needs discussion first.
- Every PR must pass CI (lint, typecheck, test, build, security scan) — see `.github/workflows/ci.yml`.

## Getting set up

Follow `docs/installation.md`.

## Where to start

- Issues labeled `good-first-issue` are scoped for newcomers.
- Issues labeled `help-wanted` are open and unassigned.
- Check `docs/roadmap.md` — Phase 1 items are the current focus.

## Code style

- TypeScript everywhere; `strict` mode on, no implicit `any`.
- Follow the existing folder structure (`apps/*`, `packages/*`, `docs/*`) — new services get their own folder under `apps/`, shared code under `packages/`.
- Prefer small, focused PRs over large ones. A PR that does one thing is easier to review and easier to revert if it's wrong.

## Commit messages

Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`) — this feeds automated changelog generation.

## Testing expectations

- New behavior needs a test. Bug fixes need a regression test.
- Run `pnpm -w test` before opening a PR.

## Architecture changes

If a PR changes a service boundary, event schema, or database schema, update the relevant doc in `docs/architecture/` in the same PR. Docs and code drifting apart is worse than no docs.

## Security issues

Please do not open a public issue for a security vulnerability. Instead email the maintainers (see `SECURITY.md` once published) or use GitHub's private vulnerability reporting.

## Code of Conduct

Standard Contributor Covenant expectations apply: be respectful, assume good faith, no harassment. Violations can be reported to the maintainers.
