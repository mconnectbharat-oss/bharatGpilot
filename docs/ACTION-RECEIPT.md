# Immutable Action Receipt

BharatGPilot now creates a content-addressed authorization receipt for autonomous changes.

The receipt binds:

- repository owner/name/ref
- exact base commit SHA
- generated branch name
- authoritative change manifest
- pre-change review
- branch-diff verification
- test result
- security findings
- final review
- final branch head SHA

The receipt contains a SHA-256 digest over a canonicalized authorization payload. Any mutation to that payload makes the receipt invalid.

The PR action gate verifies the receipt, requires verified change and final-review results, requires the supplied manifest to match the receipt, and re-checks both the base branch and generated branch heads before creating the PR.

This makes authorization content-addressed and replay-resistant across repository-state changes.