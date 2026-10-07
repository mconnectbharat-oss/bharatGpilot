# Action Gateway

Autonomous code changes require a `VERIFIED` Final Reviewer decision. Branch creation remains automatic under the action policy; PR creation additionally requires explicit approval.

The gateway uses GitHub's branch/ref and repository contents APIs for controlled changes. GitHub documents branch creation and content updates as write operations requiring repository write permissions, while pull-request creation requires pull-request write access. citeturn0search0turn0search1turn0search7

Destructive operations remain blocked by the permission policy.
