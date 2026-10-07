# Health and contribution analysis

BharatGPilot now produces two explainable outputs:

1. **Observed health signals**: a 0-100 heuristic score based only on five repository-structure signals.
2. **Contribution opportunities**: prioritized actions derived from verified gaps and directly observed open issues.

The score is explicitly labeled `heuristic-observation-v1`. It is not a security audit, code-quality proof, or production-readiness certification.

A missing signal is represented as unverified / NO EVIDENCE FOUND. It is not treated as proof that the repository lacks the underlying capability.

Contribution ranking remains scoped to the currently indexed repository and inspected issue sample.