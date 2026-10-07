import test from "node:test";
import assert from "node:assert/strict";
import { executeCodingPlan } from "../src/agents/coding-agent.js";

test("coding agent requires verified review", async () => {
  await assert.rejects(() => executeCodingPlan({
    owner:"o", repo:"r", branchName:"b", changes:[{path:"x.js",content:"x",message:"x"}],
    review:{decision:"HUMAN_REVIEW_REQUIRED"}
  }), /VERIFIED/);
});

test("coding agent rejects oversized change sets", async () => {
  await assert.rejects(() => executeCodingPlan({
    owner:"o", repo:"r", branchName:"b",
    changes:Array.from({length:11},()=>({path:"x.js",content:"x",message:"x"})),
    review:{decision:"VERIFIED"}
  }), /file limit/);
});
