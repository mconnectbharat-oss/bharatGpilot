const CONTENT_FILE_LIMIT = 200;
const MAX_FILE_BYTES = 1000000;

const MANIFESTS = new Set([
  "package.json", "pyproject.toml", "requirements.txt", "go.mod", "Cargo.toml",
  "pom.xml", "build.gradle", "build.gradle.kts", "composer.json"
]);

const DOCS = new Set(["README.md", "CONTRIBUTING.md", "SECURITY.md", "CODE_OF_CONDUCT.md"]);

export function selectContentCandidates(files) {
  return files
    .filter((file) => file.type === "blob" && typeof file.path === "string")
    .filter((file) => file.size == null || file.size <= MAX_FILE_BYTES)
    .filter((file) => MANIFESTS.has(file.path.split("/").pop()) || DOCS.has(file.path) || /\.(js|mjs|cjs|ts|tsx|py|go|rs|java|kt|rb|php|cs|cpp|c|h|hpp|sh)$/i.test(file.path))
    .slice(0, CONTENT_FILE_LIMIT);
}

export function decodeBlob(blob) {
  if (!blob || blob.encoding !== "base64" || typeof blob.content !== "string") {
    throw new Error("Unsupported Git blob encoding.");
  }
  return Buffer.from(blob.content.replace(/\n/g, ""), "base64").toString("utf8");
}

export function analyzeProjectStructure(files, contents) {
  const paths = files.map((file) => file.path);
  const languages = {};
  const extensionCounts = {};
  for (const path of paths) {
    const match = path.match(/\.([^.\/]+)$/);
    if (match) extensionCounts[match[1].toLowerCase()] = (extensionCounts[match[1].toLowerCase()] || 0) + 1;
  }
  const manifestFiles = paths.filter((path) => MANIFESTS.has(path.split("/").pop()));
  const documentationFiles = paths.filter((path) => DOCS.has(path));
  const entrypoints = paths.filter((path) => /(^|\/)(server|index|main|app)\.(js|mjs|cjs|ts|py|go|rs)$/i.test(path));
  return {
    fileCount: paths.length,
    extensionCounts,
    manifestFiles,
    documentationFiles,
    entrypoints,
    analyzedContentFiles: Object.keys(contents),
    signals: {
      hasPackageManifest: manifestFiles.includes("package.json"),
      hasReadme: paths.includes("README.md"),
      hasTestsDirectory: paths.some((path) => /(^|\/)tests?\//i.test(path)),
      hasCiDirectory: paths.some((path) => /^\.github\/workflows\//.test(path)),
      hasSecurityPolicy: paths.includes("SECURITY.md")
    }
  };
}
