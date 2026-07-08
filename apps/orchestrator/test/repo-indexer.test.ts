import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { indexRepository } from "../src/indexing/repo-indexer.js";

describe("indexRepository", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "kestrel-indexer-test-"));
    await mkdir(join(dir, "src"), { recursive: true });
    await mkdir(join(dir, "node_modules", "some-dep"), { recursive: true });

    await writeFile(join(dir, "src", "index.ts"), "export const x = 1;\nexport const y = 2;\n");
    await writeFile(join(dir, "src", "util.py"), "def f():\n    return 1\n");
    // Should be ignored entirely (node_modules).
    await writeFile(join(dir, "node_modules", "some-dep", "index.js"), "a\nb\nc\nd\n");
    await writeFile(
      join(dir, "package.json"),
      JSON.stringify({ dependencies: { react: "^18.0.0" }, devDependencies: { vitest: "^2.0.0" } })
    );
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("counts LOC by language and ignores node_modules", async () => {
    const result = await indexRepository(dir);

    // index.ts, util.py, and package.json itself (.json is a counted extension) — node_modules excluded.
    expect(result.fileCount).toBe(3);
    expect(result.locByLanguage["TypeScript"]).toBe(2);
    expect(result.locByLanguage["Python"]).toBe(2);
    expect(result.locByLanguage["JavaScript"]).toBeUndefined(); // node_modules excluded
  });

  it("extracts dependencies from package.json", async () => {
    const result = await indexRepository(dir);
    expect(result.dependencies["package.json"]).toEqual(expect.arrayContaining(["react", "vitest"]));
  });
});
