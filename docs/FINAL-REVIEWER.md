# Final Reviewer and Autonomous Action Gate

The Final Reviewer is the last decision stage before BharatGPilot can cross from analysis into an autonomous action.

## Decisions

- **VERIFIED** — available evidence, tests, and security review support proceeding within the requested permission boundary.
- **HUMAN_REVIEW_REQUIRED** — evidence is incomplete or security findings require a person to review.
- **BLOCKED** — a hard failure, such as failed tests, prevents autonomous progression.

## Gate

Only a `VERIFIED` review can pass `assertAutonomousActionAllowed`. The existing permission policy is then applied as a second gate.

This creates two independent controls:

1. **Evidence gate** — did the investigation establish enough evidence?
2. **Permission gate** — is the requested action allowed automatically?

A successful analysis therefore does not automatically authorize a merge, deployment, or destructive operation.

## Evidence discipline

Unexecuted tests remain unverified. A clean security scan is not a security certification. Missing evidence is not evidence of absence.

## Next integration

Wire Planner → Researcher → Repository Analyst → Tester → Security Reviewer → Final Reviewer into one authenticated investigation endpoint, returning the complete audit trail.
