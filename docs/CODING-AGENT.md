# Coding Agent

The Coding Agent converts an already verified plan into bounded repository changes.

Controls:
- VERIFIED Final Reviewer decision required.
- Maximum 10 changed files per action.
- Maximum 100 KB per file.
- All writes go through the Action Gateway.
- PR creation remains separately approval-gated.

This agent does not execute generated code itself. Verification must occur through the isolated execution pipeline before a PR is considered safe.
