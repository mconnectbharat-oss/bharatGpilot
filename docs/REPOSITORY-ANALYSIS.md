# Repository analysis engine

BharatGPilot now converts repository inspection data into explicit findings and recommendations.

The engine distinguishes:

- **DIRECT**: directly observed from indexed GitHub data.
- **NO EVIDENCE FOUND**: BharatGPilot could not verify the condition from its current inspection scope.
- Recommendations: proposed next actions derived from those signals.

The engine does not produce a single "healthy" verdict. Missing README, tests, CI, or security documentation are represented as unverified conditions rather than proof that the repository lacks those capabilities.

Open issues and pull requests are treated as contribution signals, but the current endpoint samples only the first 20 results returned by its GitHub API calls. A contribution recommendation should therefore remain scoped to that observed sample.

GitHub's REST API provides repository, issue, and repository metadata endpoints that support this analysis model.