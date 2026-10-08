/**
 * Build a deterministic, evidence-grounded repository brief.
 * This is deliberately model-independent: an LLM can polish it later,
 * but the factual layer remains traceable to repository inspection.
 */

function fact(value, source, classification = "DIRECT") {
  return { value, classification, source };
}

export function buildRepositoryBrief(inspection, analysis = {}) {
  if (!inspection?.repository) throw new Error("Repository inspection is required.");

  const understanding = analysis.understanding || {};
  const health = analysis.health || {};
  const structure = inspection.projectStructure || {};
  const facts = [];

  if (inspection.language) facts.push(fact(inspection.language, "repository metadata"));
  if (Number.isFinite(inspection.stars)) facts.push(fact(`${inspection.stars} stars`, "repository metadata"));
  if (Number.isFinite(inspection.forks)) facts.push(fact(`${inspection.forks} forks`, "repository metadata"));
  if (understanding.purposeSignals?.length) {
    for (const signal of understanding.purposeSignals) {
      facts.push(fact(signal.value, signal.source || "repository analysis", signal.evidence || "DIRECT"));
    }
  }
  for (const item of understanding.stack || []) {
    facts.push(fact(item.technology, item.source || "repository structure", item.evidence || "DIRECT"));
  }

  const evidence = [
    ...(inspection.evidence || []),
    ...(analysis.evidence || [])
  ];

  const direct = evidence.filter((item) => item.classification === "DIRECT").length;
  const indirect = evidence.filter((item) => item.classification === "INDIRECT").length;
  const noEvidence = evidence.filter((item) => item.classification === "NO_EVIDENCE_FOUND").length;

  return {
    repository: inspection.repository,
    ref: inspection.ref,
    coverage: inspection.treeTruncated ? "partial" : "indexed",
    summary: {
      purpose: understanding.purposeSignals?.[0]?.value || null,
      stack: understanding.stack || [],
      entrypoints: understanding.entrypoints || [],
      health: health,
    },
    facts,
    evidenceSummary: { direct, indirect, noEvidence },
    limitations: inspection.treeTruncated
      ? ["The recursive GitHub tree was truncated; repository-wide conclusions require deeper inspection."]
      : [],
    rule: "Facts are only asserted when supported by inspected repository evidence."
  };
}

export function answerRepositoryQuestion(question, brief) {
  const q = String(question || "").toLowerCase();
  if (!brief?.repository) throw new Error("Repository brief is required.");

  if (/what.*(do|purpose)|purpose|about/.test(q)) {
    return {
      answer: brief.summary.purpose
        ? `${brief.repository}: ${brief.summary.purpose}`
        : `No direct project-purpose evidence was found for ${brief.repository} in the inspected content.`,
      evidence: brief.facts.filter((item) => /description|readme/i.test(item.source || "")).slice(0, 5)
    };
  }

  if (/stack|technolog|language|framework/.test(q)) {
    return {
      answer: brief.summary.stack.length
        ? brief.summary.stack.map((item) => item.technology).join(", ")
        : "No technology-stack evidence was found in the inspected repository structure.",
      evidence: brief.summary.stack
    };
  }

  return {
    answer: `I inspected ${brief.repository}, but this question is not covered by the deterministic repository brief. More targeted GitHub evidence is required.`,
    evidence: []
  };
}
