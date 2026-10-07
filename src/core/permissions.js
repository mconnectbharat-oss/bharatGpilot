export const ACTIONS = Object.freeze({
  READ_PUBLIC_REPOSITORY: "read_public_repository",
  SEARCH_REPOSITORIES: "search_repositories",
  ANALYZE_CODE: "analyze_code",
  ANALYZE_ISSUES: "analyze_issues",
  RUN_SANDBOXED_TESTS: "run_sandboxed_tests",
  CREATE_ANALYSIS_REPORT: "create_analysis_report",
  CREATE_BRANCH: "create_branch",
  CREATE_PR: "create_pr",
  MERGE_PR: "merge_pr",
  DEPLOY_PRODUCTION: "deploy_production",
  DESTRUCTIVE_OPERATION: "destructive_operation"
});

const DEFAULT_POLICY = Object.freeze({
  [ACTIONS.READ_PUBLIC_REPOSITORY]: "automatic",
  [ACTIONS.SEARCH_REPOSITORIES]: "automatic",
  [ACTIONS.ANALYZE_CODE]: "automatic",
  [ACTIONS.ANALYZE_ISSUES]: "automatic",
  [ACTIONS.RUN_SANDBOXED_TESTS]: "automatic",
  [ACTIONS.CREATE_ANALYSIS_REPORT]: "automatic",
  [ACTIONS.CREATE_BRANCH]: "automatic",
  [ACTIONS.CREATE_PR]: "approval",
  [ACTIONS.MERGE_PR]: "approval",
  [ACTIONS.DEPLOY_PRODUCTION]: "approval",
  [ACTIONS.DESTRUCTIVE_OPERATION]: "blocked"
});

export function getActionPolicy(action) {
  if (!Object.hasOwn(DEFAULT_POLICY, action)) throw new Error("Unknown action: " + action);
  return DEFAULT_POLICY[action];
}

export function assertActionAllowed(action, { approved = false } = {}) {
  const policy = getActionPolicy(action);
  if (policy === "blocked") throw new Error("Action is blocked: " + action);
  if (policy === "approval" && !approved) throw new Error("Explicit approval is required: " + action);
  return true;
}

export function getActionPolicySnapshot() { return { ...DEFAULT_POLICY }; }
