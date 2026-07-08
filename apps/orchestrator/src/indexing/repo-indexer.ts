import { readdir, readFile, stat } from "node:fs/promises";
import { join, extname } from "node:path";

/**
 * A genuinely-working but intentionally modest slice of the "Repository
 * Intelligence Engine" described in docs/repo-intelligence/engine-design.md.
 * This walks a real cloned repo and computes real numbers — it does NOT
 * build the dependency/call graph, run SAST, or do reachability analysis
 * described there. Think of this as the "repository summary" output from
 * that doc, not the full engine. See docs/roadmap.md for what's still
 * planned.
 */

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  ".next",
  "venv",
  ".venv",
  "__pycache__",
  "target", // Rust/Java build output
  "vendor",
]);

// Extensions counted as "source" for the LOC breakdown. Anything else is
// counted toward file_count but not itemized — better an honest "other"
// bucket than a misleading per-extension breakdown for binary/asset files.
const LANGUAGE_BY_EXT: Record<string, string> = {
  ".ts": "TypeScript",
  ".tsx": "TypeScript (JSX)",
  ".js": "JavaScript",
  ".jsx": "JavaScript (JSX)",
  ".py": "Python",
  ".go": "Go",
  ".rs": "Rust",
  ".java": "Java",
  ".rb": "Ruby",
  ".php": "PHP",
  ".c": "C",
  ".h": "C header",
  ".cpp": "C++",
  ".cs": "C#",
  ".md": "Markdown",
  ".json": "JSON",
  ".yml": "YAML",
  ".yaml": "YAML",
};

const MAX_FILE_BYTES = 2_000_000; // skip counting lines in anything unusually large (likely generated/binary)
const MAX_FILES_WALKED = 20_000; // circuit breaker so a pathological repo can't hang the job indefinitely

export interface RepoSummaryResult {
  fileCount: number;
  locByLanguage: Record<string, number>;
  dependencies: Record<string, string[]>; // manifest filename -> list of dependency names
  notes: string[];
}

export async function indexRepository(rootPath: string): Promise<RepoSummaryResult> {
  const locByLanguage: Record<string, number> = {};
  let fileCount = 0;
  const notes: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (fileCount >= MAX_FILES_WALKED) return;

    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (fileCount >= MAX_FILES_WALKED) {
        notes.push(`Stopped after ${MAX_FILES_WALKED} files — repository is large enough to need the chunked/incremental indexing described in docs/repo-intelligence/engine-design.md, not a single synchronous walk.`);
        return;
      }

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        await walk(join(dir, entry.name));
        continue;
      }

      if (!entry.isFile()) continue;
      fileCount++;

      const ext = extname(entry.name);
      const language = LANGUAGE_BY_EXT[ext];
      if (!language) continue;

      const fullPath = join(dir, entry.name);
      try {
        const stats = await stat(fullPath);
        if (stats.size > MAX_FILE_BYTES) continue;
        const content = await readFile(fullPath, "utf-8");
        const lineCount = content.split("\n").length;
        locByLanguage[language] = (locByLanguage[language] ?? 0) + lineCount;
      } catch {
        // Unreadable (permissions, binary masquerading as text, race with a
        // deleted file) — skip rather than fail the whole indexing job over
        // one file.
        continue;
      }
    }
  }

  await walk(rootPath);

  const dependencies = await extractDependencies(rootPath);

  return { fileCount, locByLanguage, dependencies, notes };
}

async function extractDependencies(rootPath: string): Promise<Record<string, string[]>> {
  const result: Record<string, string[]> = {};

  async function readIfExists(path: string): Promise<string | null> {
    try {
      return await readFile(path, "utf-8");
    } catch {
      return null;
    }
  }

  const packageJson = await readIfExists(join(rootPath, "package.json"));
  if (packageJson) {
    try {
      const parsed = JSON.parse(packageJson);
      result["package.json"] = [
        ...Object.keys(parsed.dependencies ?? {}),
        ...Object.keys(parsed.devDependencies ?? {}),
      ];
    } catch {
      // Malformed package.json — note the omission rather than guessing at content.
    }
  }

  const requirementsTxt = await readIfExists(join(rootPath, "requirements.txt"));
  if (requirementsTxt) {
    result["requirements.txt"] = requirementsTxt
      .split("\n")
      .map((line) => line.split(/[=<>~!]/)[0].trim())
      .filter((line) => line && !line.startsWith("#"));
  }

  const goMod = await readIfExists(join(rootPath, "go.mod"));
  if (goMod) {
    const requireLines = goMod
      .split("\n")
      .filter((line) => line.trim().startsWith("require") || /^\s+[\w./-]+\s+v[\d.]/.test(line));
    result["go.mod"] = requireLines
      .map((line) => line.replace("require", "").trim().split(/\s+/)[0])
      .filter(Boolean);
  }

  return result;
}
