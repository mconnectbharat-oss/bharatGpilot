# Post-Change Verification

The change loop verifies the branch after coding, not only the original repository snapshot.

After bounded changes are applied:
1. Tests target the generated branch ref.
2. GitHub repository inspection targets that same branch ref.
3. Security review scans the post-change inspection.
4. Final review uses the resulting test and security evidence.

This preserves the evidence chain and avoids treating pre-change inspection as proof of the modified state.
