# CI Enforcement

BharatGPilot treats CI as an authorization prerequisite, not an informational signal.

## Required workflow

The `BharatGPilot CI` workflow runs the test suite on Node 20, 22, and 24. The `Security gate` job aggregates the matrix and fails whenever any matrix job fails, is cancelled, or is otherwise unsuccessful.

The workflow also runs for GitHub merge-queue `merge_group` events.

## Repository protection

The repository's `main` branch should require the `Security gate` check before merging. This repository integration currently has read access to rulesets but no administration/write capability to create or modify the GitHub branch-protection/ruleset itself. Therefore this file documents the required repository-level setting rather than falsely claiming it is configured.

Once repository administration is available, configure a ruleset for `main` that requires the `Security gate` status check and prevents bypass except for explicitly trusted administrators.

## Application-level enforcement

BharatGPilot independently checks the exact action commit's required CI checks before autonomous PR creation or approved merge actions. Repository protection is the second, independent boundary.

A failure in either boundary must prevent the action.
