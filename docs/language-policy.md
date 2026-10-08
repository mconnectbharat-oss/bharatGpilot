# BharatGPilot implementation language policy

## Mandatory language constraint

All new BharatGPilot application code and all new production features must use only these languages:

1. **TypeScript** — primary language for the web application, API gateway, provider adapters, user-facing API-key connections, model registry, and agent orchestration interfaces.
2. **Python** — AI/ML pipelines, evaluation, retrieval, model-specific data processing, and research/agent services where Python ecosystem support is materially useful.
3. **Rust** — security-sensitive, performance-critical components such as high-throughput gateway utilities, policy enforcement, and resource-constrained services when profiling justifies it.
4. **Go** — concurrent infrastructure services, background workers, provider health checks, and operational tooling where Go is the better fit.

Do not introduce JavaScript, Java, C#, PHP, Ruby, or other programming languages for new application code. JSON, YAML, SQL, HTML, and CSS may be used as configuration, database schema, or presentation formats; they are not additional application programming languages.

## Repository migration policy

The repository currently contains JavaScript/ES modules and an Express server. This existing code is legacy until migrated; it is not evidence that the codebase already complies with this policy.

- New production logic must be written in TypeScript, Python, Rust, or Go.
- Do not add new JavaScript files or expand the legacy JavaScript implementation.
- Migrate existing JavaScript modules incrementally to TypeScript, preserving API compatibility and tests.
- Use a staged migration with small pull requests, tests, and rollback points; do not perform a risky all-at-once rewrite.
- Keep the deployed application functional during migration. Do not claim full compliance until executable application code has been audited.
- If an existing runtime or deployment tool requires JavaScript, treat that as an explicit migration exception only when unavoidable, document the reason, and keep it out of new business logic.

## Recommended ownership

| Area | Preferred language |
| --- | --- |
| Frontend and typed API | TypeScript |
| Main API gateway and provider adapters | TypeScript |
| AI evaluation, RAG and ML data pipelines | Python |
| Performance-critical security utilities | Rust, only when needed |
| Concurrent workers and infrastructure agents | Go, only when needed |
| Database schema | SQL migrations |
| CI and deployment configuration | YAML/configuration |

Avoid building the same feature twice in multiple languages. Add a Rust or Go service only when there is a clear performance, security, or operational reason; otherwise keep the service in TypeScript or Python to reduce complexity and maintenance cost.

## Acceptance criteria

- Every new application source file uses TypeScript, Python, Rust, or Go.
- CI checks the allowed source extensions and flags new legacy JavaScript files, with documented exceptions only.
- TypeScript uses strict type checking; Python has automated tests and linting; Rust and Go components have unit tests and standard formatting checks.
- Existing JavaScript modules are tracked in a migration inventory.
- Security, API compatibility, tests, and deployment health are verified before each migration step is merged.

## Status

This policy is now the required direction for future work. It is a policy document, not proof that the existing repository has already been migrated. The next engineering step is to inventory JavaScript modules and migrate the API gateway and model router to TypeScript in small, tested changes.
