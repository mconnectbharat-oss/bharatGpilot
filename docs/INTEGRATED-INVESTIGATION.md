# Integrated Investigation Pipeline

The authenticated /api/pilot/investigate flow now composes Planner, Researcher, Repository Analyst, Tester, Security Reviewer, Final Reviewer, and the CREATE_BRANCH action gate.

Repository code is not executed from remote inspection. The current flow records sandbox execution as NOT_EXECUTED, which conservatively produces HUMAN_REVIEW_REQUIRED until an isolated workspace is provisioned.

The response includes the inspection, evidence-backed analysis, test status, security findings, final decision, and action disposition.
