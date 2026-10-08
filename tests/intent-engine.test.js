import assert from "node:assert/strict";
import test from "node:test";
import { buildCopilotSystemPrompt, detectIntent } from "../src/services/intent-engine.js";

test("detects GitHub repository requests", () => {
  const result = detectIntent("Analyze this GitHub repository and its issues");
  assert.equal(result.intent, "github_repository");
  assert.ok(result.capabilities.includes("github"));
});

test("detects coding requests", () => {
  const result = detectIntent("Debug this JavaScript function");
  assert.equal(result.intent, "coding");
});

test("falls back to chat for empty input", () => {
  assert.equal(detectIntent("").intent, "chat");
});

test("builds an evidence-first system prompt", () => {
  const prompt = buildCopilotSystemPrompt({ intent: "research", capabilities: ["research"] });
  assert.match(prompt, /DIRECT/);
  assert.match(prompt, /NO_EVIDENCE_FOUND/);
  assert.match(prompt, /research/);
});


test("extracts owner/repo from a GitHub URL", () => {
  const result = detectIntent("What does https://github.com/facebook/react do?");
  assert.equal(result.intent, "github_repository");
  assert.deepEqual(result.repository, { owner: "facebook", repo: "react" });
});

test("extracts owner/repo from natural repository wording", () => {
  const result = detectIntent("What does facebook/react do?");
  assert.deepEqual(result.repository, { owner: "facebook", repo: "react" });
});
