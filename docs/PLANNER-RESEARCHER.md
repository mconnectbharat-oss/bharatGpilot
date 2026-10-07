# Planner and Researcher

BharatGPilot separates planning from evidence collection.

The planner converts a natural-language request into investigation signals, permitted evidence actions, and an explicit verification requirement. It does not claim that any finding is true.

The researcher executes the supported read-only repository investigation through the existing GitHub repository intelligence layer. Automatic actions are limited to reading public repositories and analyzing repository code and issue/PR data. Approval-gated actions such as PR creation remain outside this pipeline, while destructive actions remain blocked.

Evidence remains classified as DIRECT, INDIRECT, or NO EVIDENCE FOUND. A truncated recursive Git tree is not treated as complete repository coverage.

API: POST /api/pilot/investigate

Request body fields: request and repository (owner/name).

The endpoint requires authentication and returns the investigation plan plus the collected repository inspection.

Pipeline: Planner -> Researcher -> Repository Analyst -> Tester -> Security Reviewer -> Final Reviewer.
