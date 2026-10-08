/**
 * BharatGPilot intent engine.
 * Deterministic first-pass routing keeps user intent explainable and testable.
 */

const RULES = Object.freeze([
  { intent: "github_repository", patterns: [/github\.com\//i, /repo(sitory)?/i, /pull request|\bpr\b/i, /issue(s)?/i, /commit(s)?/i, /branch(es)?/i] },
  { intent: "coding", patterns: [/\bcode\b/i, /debug|bug|error|exception|refactor|implement|function|api|javascript|typescript|python|sql/i] },
  { intent: "research", patterns: [/research|compare|latest|evidence|source|citation|investigate|analy[sz]e/i] },
  { intent: "explanation", patterns: [/what is|explain|how does|why does|meaning|define/i] },
  { intent: "creative", patterns: [/write|rewrite|draft|story|poem|prompt|design|idea/i] }
]);

const CAPABILITY_BY_INTENT = Object.freeze({
  github_repository: ["github", "research", "reasoning"],
  coding: ["coding", "reasoning"],
  research: ["research", "reasoning"],
  explanation: ["chat", "reasoning"],
  creative: ["chat"]
});

export function extractGitHubRepository(input = "") {
  const text = String(input).trim();
  const url = text.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:[/?#\s]|$)/i);
  if (url) return { owner: url[1], repo: url[2].replace(/\.git$/i, "") };

  const pair = text.match(/(?:^|\s)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?=\s|[?.,!]|$)/);
  if (pair && /github|repo(sitory)?|project|what does|how does|about/i.test(text)) {
    return { owner: pair[1], repo: pair[2].replace(/\.git$/i, "") };
  }
  return null;
}

export function detectIntent(input = "") {
  const text = String(input).trim();
  const repository = extractGitHubRepository(text);
  if (!text) return { intent: "chat", confidence: 0.35, capabilities: ["chat"], signals: [], repository: null };

  let best = { intent: "chat", score: 0, signals: [] };
  for (const rule of RULES) {
    const signals = rule.patterns.filter((pattern) => pattern.test(text)).map(String);
    const score = signals.length;
    if (score > best.score) best = { intent: rule.intent, score, signals };
  }

  if (repository) {
    best = {
      intent: "github_repository",
      score: Math.max(best.score, 2),
      signals: [...best.signals, "github_repository_entity"],
      repository
    };
  }

  const confidence = best.intent === "chat"
    ? 0.35
    : Math.min(0.98, 0.55 + best.score * 0.12);

  return {
    intent: best.intent,
    confidence,
    capabilities: CAPABILITY_BY_INTENT[best.intent] || ["chat"],
    signals: best.signals,
    repository: repository || null
  };
}

export function buildCopilotSystemPrompt(intentResult) {
  const intent = intentResult?.intent || "chat";
  return [
    "You are BharatGPilot, an evidence-first AI copilot.",
    "Do not present guesses as verified facts.",
    "When evidence is available, distinguish DIRECT evidence from INDIRECT inference.",
    "If evidence is unavailable, say NO_EVIDENCE_FOUND plainly.",
    `Current user intent: ${intent}.`,
    `Prioritize capabilities: ${(intentResult?.capabilities || ["chat"]).join(", ")}.`
  ].join(" ");
}
