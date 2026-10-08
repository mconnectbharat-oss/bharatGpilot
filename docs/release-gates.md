# BharatGPilot release gates

This repository is not considered production-ready merely because a change is committed or documented.

## Required before any runtime migration is merged or deployed

- [ ] Install dependencies reproducibly; add and commit a lockfile before switching CI to `npm ci`.
- [ ] TypeScript build/type-check succeeds for all migrated runtime modules.
- [ ] Existing test suite and new regression tests pass on supported Node versions.
- [ ] API route contract checks verify paths, methods, authentication, status codes, and response shapes.
- [ ] Deployment platform and runtime are confirmed from the actual project settings; verify build/start commands and environment-variable configuration.
- [ ] Secret scan passes; review repository history and deployment logs for accidental credential exposure. Rotate any exposed credentials.
- [ ] Database migrations are tested against a disposable database and a rollback/backup plan is documented.
- [ ] Pull request checks are green and changes are reviewed.
- [ ] Only then may a human-authorized merge or deployment proceed.

## Evidence standard

Mark each gate as **PASS**, **FAIL**, or **UNVERIFIED** and link to the run, test, configuration, or review that supports it. Never mark a gate PASS based only on documentation, a successful unrelated deployment check, or the presence of scaffolding.

## Current migration boundary

The production entry point still imports `src/services/model-router.js`. The TypeScript provider HTTP helper is not wired into the runtime. The existence of TypeScript contracts or a helper must not be described as a completed router migration.
