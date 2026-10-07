import test from "node:test";
import assert from "node:assert/strict";
import { actionDisposition, finalReview, REVIEW_DECISIONS } from "../src/agents/final-reviewer.js";

const basePlan = {
  repository: { owner: "example", name: "repo" },
  steps: [],
  evidence: []
};

test("requires human review when tests were not executed", () => {
  const result = finalReview({ plan: basePlan, testResult: { status: "not_executed" } });
  assert.equal(result.review.decision, REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED);
});

test("blocks after failed tests", () => {
  const result = finalReview({
    plan: basePlan,
    testResult: { status: "failed" },
    security: { findings: [] }
  });
  assert.equal(result.review.decision, REVIEW_DECISIONS.BLOCKED);
});

test("requires human review for security findings", () => {
  const result = finalReview({
    plan: basePlan,
    testResult: { status: "passed" },
    security: { findings: [{ id: "credential-reference" }] }
  });
  assert.equal(result.review.decision, REVIEW_DECISIONS.HUMAN_REVIEW_REQUIRED);
});

test("only VERIFIED reviews can pass the autonomous action gate", () => {
  const result = finalReview({
    plan: basePlan,
    testResult: { status: "passed" },
    security: { findings: [] }
  });
  // With no unverified evidence, this can proceed.
  assert.equal(result.review.decision, REVIEW_DECISIONS.VERIFIED);
  assert.equal(actionDisposition(result.review, "CREATE_BRANCH").allowed, true);
});
