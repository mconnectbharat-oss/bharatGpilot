# Authoritative Change Manifest

The Coding Agent now creates the change manifest before writing files. The same manifest is returned with the coding result and is required for PR creation.

Each entry records:
- repository path
- bounded byte count
- commit message
- content fingerprint

The gateway independently validates every write, so the manifest is a policy boundary rather than an informational report.
