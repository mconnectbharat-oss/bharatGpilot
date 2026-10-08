# Vercel Express migration assessment (isolated; no deployment)

**Status:** assessment only. No deployment configuration was changed because a trustworthy Vercel build could not be run in this environment without linking the real Vercel project and its project settings.

## Current configuration

- `vercel.json` uses the legacy `builds` property with `@vercel/node` for `server.js`.
- Its ordered `routes` send `/api/(.*)` and then `/(.*)` to `/server.js`.
- `server.js` creates an Express app, defines the API endpoints and a catch-all HTML route, exports `app` as the default export, and only calls `app.listen` outside production.
- `package.json` declares `@vercel/node` directly.

## Supported options considered

### A. Keep the existing legacy configuration (lowest immediate routing risk)

Keep the builder and both routes. This preserves the current explicit routing contract, but retains the dependency chain that brought in `@vercel/static-config`, `ts-morph`, `fast-glob`, and the vulnerable `braces` dependency. It does not solve the transitive audit finding.

### B. Migrate to Vercel's current zero-configuration Express detection (candidate for a separate experiment)

Vercel's Express guide documents zero-configuration deployment when the app is exported from a recognized entry file such as root `server.js`. This repository already exports the Express app as default, and the app itself defines API routes and a catch-all page route.

A minimal candidate would remove the legacy `builds` and `routes` properties from `vercel.json` (or replace them with only supported non-legacy configuration) and let Vercel's Express integration route requests to the app. This is **not** yet a verified drop-in replacement:
- It must be confirmed that both the `/api/(.*)` and `/(.*)` behaviours remain covered by Express's routes.
- Static files under `public/` must be checked against Vercel's static-file handling.
- Removing the direct `@vercel/node` dependency should only be considered after a real build proves it is no longer needed.
- Preview HTTP checks must cover `/api/health`, a representative API 404, and a non-API path returning the intended page.

Vercel's documentation says `builds` is a legacy property and recommends moving to newer configuration, and its Express documentation says Express apps can be deployed with zero configuration:
- https://vercel.com/docs/project-configuration/vercel-json
- https://vercel.com/docs/frameworks/backend/express

## Why no migration patch or build workflow was added

A real `vercel build` requires the project to be linked and may need project metadata/environment configuration. Those project identifiers/settings and a safe authenticated build context are not present in this isolated source-only workflow. A JSON schema check or unit tests alone cannot prove Vercel deployment compatibility, and triggering a deployment is explicitly out of scope.

## Required gate before changing configuration

1. Link the intended Vercel project in a controlled preview environment; do not deploy to production.
2. Create a new branch for the candidate configuration and run the Vercel CLI build with the correct project settings.
3. Run tests and typecheck, then inspect build output for function and static asset inclusion.
4. Use a preview deployment only if separately authorized, and smoke-test the routes listed above.
5. Compare dependency tree and `npm audit`; verify that the builder chain actually disappears before claiming the vulnerability is mitigated.
6. Keep `main`, `.github/workflows/ci.yml`, and production deployment untouched until every gate passes.

**Decision:** retain the existing configuration for now. This branch records the assessment only; it intentionally does not change `vercel.json`, `package.json`, or CI.
