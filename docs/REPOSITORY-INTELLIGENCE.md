# Repository intelligence

The repository analysis foundation now combines several read-only GitHub API surfaces:

- repository metadata
- root contents
- README retrieval
- issues
- pull requests
- releases

The analysis response preserves raw, directly observed facts separately from interpretation.

## Evidence discipline

A successful GitHub API response is DIRECT evidence that the API returned that information.

Failure to retrieve a source is represented as NO EVIDENCE FOUND where appropriate. It is not treated as proof that the underlying repository property does not exist.

## Current limitations

- Content indexing is currently shallow; it does not recursively index the entire repository.
- Issue/PR/release retrieval is capped to the first 20 results per endpoint.
- Health scoring and contribution recommendations are not yet implemented.
- Authentication still uses the foundation's process-local store.
- GitHub App installation credentials are not implemented yet.
