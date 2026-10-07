# Branch Diff Verification

Before a generated branch can be considered an approved change, BharatGPilot compares the base ref with the generated branch and checks every changed path against the authoritative manifest.

Results:
- VERIFIED: exact path set matches.
- MISMATCH: unexpected or missing paths exist.
- UNVERIFIED: GitHub comparison is unavailable or too large.

A mismatch must prevent PR progression.
