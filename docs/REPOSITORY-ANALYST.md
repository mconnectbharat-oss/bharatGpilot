# Repository Analyst

The Repository Analyst is the next controlled stage after evidence collection.

It consumes the inspection produced by the Researcher and delegates to the existing evidence-backed analysis engine:

- project understanding
- technology and entrypoint signals
- repository health heuristic
- contribution opportunities
- evidence-backed findings and recommendations

The analyst does not invent repository facts. It operates on an existing inspection object and preserves the evidence classifications.

Pipeline:

Planner -> Researcher -> Repository Analyst -> Tester -> Security Reviewer -> Final Reviewer

The health score remains a structural heuristic, not a security audit or production-readiness certification.
