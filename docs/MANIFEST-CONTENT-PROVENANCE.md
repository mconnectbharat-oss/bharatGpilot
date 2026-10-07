# Manifest Content Provenance

The action manifest is now cryptographically bound to the intended file content.

- Each entry records a SHA-256 digest and byte count.
- The mutation gateway requires every write to match its manifest entry.
- Existing-file reads are performed against the target branch, not the default branch.
- Branch verification rejects deletions/unsupported change statuses.
- Post-change verification re-reads each approved file from the generated branch and recomputes its SHA-256 digest.

GitHub's Contents API supports selecting a branch/tag/commit through the `ref` query parameter, so verification can inspect the exact generated branch rather than silently falling back to the repository default branch.