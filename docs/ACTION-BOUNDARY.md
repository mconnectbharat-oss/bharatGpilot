# Action Boundary

Autonomous repository changes are bounded by a change manifest.

Controls:
- Maximum 10 files and 100 KB per file.
- Safe repository and branch paths only.
- Workflow files, `.gitmodules`, and dependency lockfiles require explicit approval.
- Optional expected blob SHA prevents overwriting a file whose base changed after planning.
- PR creation requires a manifest plus the existing VERIFIED and approval gates.

The manifest records file paths, byte counts, messages, and a content fingerprint field for audit correlation. It is not a substitute for post-change verification.
