const phases = [
  { phase: "Phase 0", label: "Scaffold", status: "shipped" },
  { phase: "Phase 1", label: "Single-repo agent (MVP)", status: "in progress" },
  { phase: "Phase 2", label: "Repository intelligence engine", status: "planned" },
  { phase: "Phase 3", label: "Multi-agent collaboration", status: "planned" },
  { phase: "Phase 4", label: "Memory across runs", status: "planned" },
  { phase: "Phase 5", label: "Scale-out (multi-region, Kafka)", status: "planned" },
];

const statusColor: Record<string, string> = {
  shipped: "text-kestrel-moss",
  "in progress": "text-kestrel-rust",
  planned: "text-slate",
};

export function Roadmap() {
  return (
    <section id="roadmap" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl font-semibold text-cream">Roadmap</h2>
        <p className="mt-4 text-slate">
          Built in phases — each one is usable on its own. See{" "}
          <span className="font-mono text-sm">docs/roadmap.md</span> for the detailed breakdown.
        </p>
        <ol className="mt-10 space-y-4">
          {phases.map((p) => (
            <li
              key={p.phase}
              className="flex items-center justify-between border-b border-white/10 pb-4 font-mono text-sm"
            >
              <span className="text-cream">
                {p.phase} — {p.label}
              </span>
              <span className={statusColor[p.status]}>{p.status}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
