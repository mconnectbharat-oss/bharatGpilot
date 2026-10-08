# Incremental TypeScript migration plan

## Current verified starting point

The application currently starts with `node server.js`, declares `"type": "module"`, and uses JavaScript ES modules. The existing test command is `node --test`. The server imports the model router and other service modules through explicit `.js` paths. Do not switch the production start command or rewrite import paths until the runtime/build strategy is tested.

## Goal

New application logic must be TypeScript, Python, Rust, or Go. TypeScript is the default for the API gateway, model routing, provider adapters, and typed contracts. Existing JavaScript remains migration debt until each module is converted and verified.

## Safe migration sequence

1. **Baseline first:** run the existing test suite and record failures before changing runtime/build behavior. Confirm the deployed Node version and deployment platform.
2. **Introduce TypeScript tooling:** add a pinned TypeScript compiler and type definitions; configure strict checking without requiring the entire legacy tree to pass immediately.
3. **Migrate one isolated service:** start with the model-router contract and provider-neutral helper types. Preserve the current API and behavior. Keep the existing runtime path until compiled output and import resolution are verified.
4. **Add behavior-parity tests:** retain provider fallback, explicit-provider strictness, error normalization, and router-order tests. Add coverage for malformed provider responses and timeout/abort behavior before changing implementation.
5. **Switch one module at a time:** use a tested build output or a deployment-supported TypeScript runtime. Do not assume Node's TypeScript support or a local toolchain is available in production.
6. **Migrate the API gateway and remaining services:** only after the first service is verified; keep compatibility and rollback points.
7. **Enforce policy:** add CI checks that reject new JavaScript application files while allowing documented legacy files to remain during migration. Audit all source paths before declaring compliance.

## Security gates for model routing

- Keep API credentials server-side; never return secret values from status or catalog endpoints.
- Use a provider allowlist and trusted provider base URLs; do not accept arbitrary user-supplied request URLs.
- Never silently route a user into paid usage. Enforce free-only and budget controls before provider calls.
- Keep explicit provider selection strict; fallback should happen only in automatic routing mode.
- Redact credentials and sensitive provider response details from logs.
- Add request timeouts and bounded response sizes before exposing user-configurable model connections.

## Current known migration targets

The following files were confirmed in the feature branch and are examples, not a complete repository inventory:

- `server.js` — main Express API entry point
- `src/services/model-router.js` — provider routing and request handling
- `src/services/model-catalog.js` — model metadata catalog
- `src/services/agent-memory.js` — persistent user-scoped memory service
- `src/services/n8n-automation.js` — allowlisted webhook dispatch
- `tests/model-router.test.js` — existing Node test coverage

Other JavaScript files must be discovered from the repository tree before the migration inventory can be called complete.

## Release gate

Do not merge or deploy a runtime migration until the build succeeds, tests pass, routes remain compatible, the deployment platform is verified, and secrets are confirmed not to be exposed. A documentation-only step does not mean that the application has been migrated.
