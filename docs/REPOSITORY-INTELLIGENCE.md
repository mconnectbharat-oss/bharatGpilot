# Repository content analysis

BharatGPilot now performs bounded content ingestion after recursive tree indexing.

## What is ingested

Candidate files are limited to 200 files and approximately 1 MB per file. Candidates include common project manifests, core documentation, and common source-code extensions.

GitHub's Git blob API supports blob retrieval up to 100 MB, but BharatGPilot deliberately uses a much smaller application-level bound to keep repository analysis predictable. citeturn0search2turn0search1

## What is derived

The deterministic structure analyzer reports:

- file and extension counts
- manifest files
- documentation files
- likely entrypoints
- analyzed content paths
- presence signals for README, tests, CI workflows, package manifests, and SECURITY.md

These are **signals**, not claims that a project is healthy, production-ready, secure, or easy to contribute to.

## Evidence discipline

Unavailable or oversized content is skipped rather than interpreted as evidence that the corresponding file is absent or empty.

Recursive-tree truncation remains explicit and prevents BharatGPilot from treating an incomplete index as a complete repository model.
