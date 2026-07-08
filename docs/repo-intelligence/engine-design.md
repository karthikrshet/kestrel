# Repository Intelligence Engine — Design

## Goal

Build a queryable model of a repository — its structure, dependencies, and quality signals — that agents consult during planning instead of re-discovering the codebase from scratch on every run, and that produces human-readable reports on its own.

## Handling repositories with millions of lines of code

The naive approach (parse everything into memory at once) doesn't work at that scale. Kestrel's design instead:

1. **Incremental, chunked indexing.** The repo is split by natural boundaries (packages/modules/directories); each chunk is indexed as an independent job (`repo.index.requested` per chunk, see `../architecture/04-event-schemas.md`), so indexing time scales with change volume, not repo size, after the first full pass.
2. **Re-index only what changed.** After the first full index, subsequent commits trigger re-indexing of only the changed files and their direct dependents (determined from the dependency graph itself) — not a full re-scan.
3. **Language-specific parsers, shared graph model.** Each supported language has its own parser (tree-sitter grammars are a practical choice) that emits a common intermediate representation (symbols, imports, call edges), which is what actually populates the graph store — this keeps adding a new language additive rather than a rewrite.
4. **Graph store choice scales with repo count.** Small repos: an in-process graph library or Postgres recursive CTEs are sufficient. Large-scale (many orgs, huge monorepos): a dedicated graph database (Neo4j, Amazon Neptune, or a custom adjacency-list schema on a columnar store) for traversal performance.

## Capabilities and how each is actually computed

| Capability | Approach |
|---|---|
| **Repository graph creation** | Parse files → symbols + import/call edges → graph nodes (files, functions, classes) and edges (imports, calls, inherits) |
| **Dependency analysis** | Traverse import edges; flag version conflicts and outdated packages via manifest file parsing (package.json, requirements.txt, go.mod, etc.) cross-referenced against a vulnerability/version feed |
| **Architecture analysis** | Cluster the graph (e.g., by directory + import density) and compare against common architectural patterns (layered, hexagonal, monolith-with-modules) to flag violations (e.g., a "domain" module importing directly from an "infrastructure" module against the intended layering) |
| **Security analysis** | Integrate existing SAST tools (e.g., Semgrep rulesets) rather than reinventing static analysis; the graph adds *context* (is this vulnerable function actually reachable from an external entry point?) on top of raw findings |
| **Technical debt analysis** | Composite score from: cyclomatic complexity per function, churn (commit frequency) × complexity (hot spots), test coverage gaps, and TODO/FIXME density |
| **Dead code detection** | Graph reachability analysis from known entry points (main functions, exported API surface, route handlers); nodes unreachable from any entry point are flagged, with a confidence discount for dynamic-dispatch-heavy languages where static reachability is inherently incomplete |
| **Refactoring opportunities** | Pattern-match against the graph for common smells: duplicated logic (structural similarity across functions), god objects (unusually high fan-in/fan-out), circular dependencies |
| **Performance bottleneck detection** | Static heuristics (nested loops over unbounded collections, N+1 query patterns via ORM call detection) flagged for human/agent review — presented as *candidates to investigate*, not definitive findings, since static analysis can't measure actual runtime behavior |
| **Vulnerability scanning** | Dependency manifest cross-referenced against a CVE feed (e.g., OSV database); flagged findings include the graph path showing whether the vulnerable code is actually reachable |
| **API relationship mapping** | Detect route/handler definitions and client call sites; build a service-to-service or endpoint-to-consumer map, useful both for agents (understand blast radius of a change) and for human architecture reviews |

## Generated outputs

- **Architecture diagrams:** auto-generated Mermaid/C4-style diagrams derived from the module-level clustering of the graph — kept as *generated artifacts*, regenerated on demand, never hand-edited (hand-edits would be silently overwritten on next index).
- **Dependency graphs:** exportable in a standard graph format (e.g., DOT/GraphML) for use in external tooling.
- **Repository summaries:** a short structured document per repo (languages, module count, key entry points, top complexity hot spots) — the same document an agent's planner consults before starting a run.
- **Engineering reports:** point-in-time snapshots (e.g., monthly) tracking technical debt score trend, dependency freshness, and test coverage over time.
- **Technical debt reports:** ranked list of hot spots with a suggested remediation size estimate (small/medium/large), intended to feed a human prioritization conversation, not to auto-schedule work.

## Honesty about limits

Static analysis at this scale has real limits: dynamic languages, reflection-heavy code, and generated code reduce precision. The engine reports a confidence level with its findings rather than presenting every flag as certain, and agents are instructed to treat Intelligence Service output as *context to verify*, not ground truth, before acting on it.
