# Security Reviewer Agent

The Security Reviewer is a bounded, evidence-producing stage before final review.

It scans the currently ingested repository content for high-risk signals including privileged GitHub Actions triggers, possible shell interpolation of untrusted GitHub context, credential references, and process-execution APIs.

A clean scan means only that no configured pattern was observed in the inspected sample. It does **not** establish that the repository is secure.

GitHub's current security guidance specifically warns that privileged workflow triggers combined with untrusted pull-request code can expose secrets and repository write access, and recommends avoiding those patterns unless carefully isolated. citeturn0search0turn0search2turn0search3

## Execution boundary

The Security Reviewer runs before autonomous code changes are accepted. Any finding produces `review_required` and remains evidence for the Final Reviewer.

## Next integration

Connect Tester + Sandbox + Security Reviewer into the investigation pipeline, then implement Final Reviewer gating so risky or unverified work cannot advance to autonomous actions.
