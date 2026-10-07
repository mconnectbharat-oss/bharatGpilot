const LANGUAGE_MAP = {
  js: "JavaScript", mjs: "JavaScript", cjs: "JavaScript", ts: "TypeScript", tsx: "TypeScript",
  py: "Python", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin", rb: "Ruby", php: "PHP",
  cs: "C#", cpp: "C++", c: "C", sh: "Shell"
};

export function inferTechnologyStack(projectStructure, contents = {}) {
  const counts = projectStructure?.extensionCounts || {};
  const stack = [];
  for (const [ext, count] of Object.entries(counts)) {
    if (LANGUAGE_MAP[ext]) stack.push({ technology: LANGUAGE_MAP[ext], evidence: "DIRECT", files: count });
  }
  if (projectStructure?.manifestFiles?.includes("package.json")) stack.push({ technology: "Node.js ecosystem", evidence: "DIRECT", source: "package.json" });
  if (projectStructure?.manifestFiles?.includes("pyproject.toml") || projectStructure?.manifestFiles?.includes("requirements.txt")) stack.push({ technology: "Python ecosystem", evidence: "DIRECT", source: "Python manifest" });
  return stack;
}

export function extractProjectUnderstanding(inspection) {
  const contents = inspection.analyzedContents || {};
  const readme = contents["README.md"] || "";
  const packageJson = contents["package.json"];
  let packageData = null;
  if (packageJson) {
    try { packageData = JSON.parse(packageJson); } catch { packageData = null; }
  }

  const purposeSignals = [];
  if (packageData?.description) purposeSignals.push({ value: packageData.description, evidence: "DIRECT", source: "package.json" });

  const readmeLines = readme.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const heading = readmeLines.find((line) => /^#{1,2}\s+/.test(line));
  if (heading) purposeSignals.push({ value: heading.replace(/^#{1,2}\s+/, ""), evidence: "DIRECT", source: "README.md" });

  const stack = inferTechnologyStack(inspection.projectStructure, contents);
  const entrypoints = inspection.projectStructure?.entrypoints || [];

  return {
    purposeSignals,
    projectName: packageData?.name || inspection.repository,
    version: packageData?.version || null,
    stack,
    entrypoints,
    documentationSignals: {
      readmeAvailable: Boolean(readme),
      contributingAvailable: Boolean(contents["CONTRIBUTING.md"]),
      securityPolicyAvailable: Boolean(contents["SECURITY.md"])
    },
    interpretation: purposeSignals.length
      ? "Purpose signals were directly extracted from repository documentation or manifest metadata."
      : "No direct project-purpose signal was extracted from the currently ingested content."
  };
}
