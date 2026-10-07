# Change Verification Loop

The autonomous change path is now structured as:

1. Evidence-backed pre-change review.
2. Bounded Coding Agent change.
3. Isolated repository test execution.
4. Security review.
5. Final review.
6. PR action gate.

A PR is only eligible after the post-change final review is `VERIFIED` and the configured PR approval is present. Failed tests block the flow; unavailable execution produces a review-required state.

The implementation intentionally does not claim verification when sandbox execution is unavailable.
