# Scientific claim-evidence model

BharatGPilot treats repository statements as claims that must be linked to evidence.

- **DIRECT**: the repository/GitHub source directly supports the claim.
- **INDIRECT**: the claim is an explicit inference from available evidence.
- **NO EVIDENCE FOUND**: BharatGPilot could not verify the claim from the inspected evidence. This is not evidence that the underlying fact is false.
- A claim with DIRECT evidence is **SUPPORTED**.
- A claim with only INDIRECT evidence is **INFERRED**.
- A claim with no supporting evidence is **UNVERIFIED**.

The claim model preserves stable claim IDs and evidence references so downstream reviewers can audit why a statement was made. A scientific-quality answer should not silently convert absence of evidence into a negative fact.

The repository-analysis output now returns both the existing evidence records and linked claims.
