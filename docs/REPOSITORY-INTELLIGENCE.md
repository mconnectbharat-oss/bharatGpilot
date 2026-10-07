# Repository intelligence

The analysis foundation now uses GitHub's recursive Git tree API to index repository paths in addition to metadata, README, issues, pull requests, and releases.

## Recursive indexing

The indexed result separates:

- `indexedFiles`: file paths, sizes, and Git object SHAs returned by GitHub
- `indexedDirectories`: directory paths returned by GitHub
- `treeTruncated`: whether GitHub reported that the recursive response was truncated

GitHub documents a maximum recursive tree response of 100,000 entries / 7 MB. When GitHub reports truncation, BharatGPilot marks complete indexing as **NO EVIDENCE FOUND** rather than treating the partial tree as complete.

## Current limitations

- File contents are not yet ingested; this layer indexes paths and Git metadata.
- Issues/PRs/releases are capped to the first 20 results per endpoint.
- Health scoring and contribution recommendations are not yet implemented.
- Authentication still uses the foundation's process-local store.
- GitHub App installation credentials are not implemented yet.
