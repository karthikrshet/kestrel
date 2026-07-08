const planes = [
  { name: "Control plane", detail: "Auth, orgs, repos, billing — scales with users" },
  { name: "Orchestration plane", detail: "Agent state machine, planning — scales with active runs" },
  { name: "Execution plane", detail: "Sandboxed tool execution — scales to 100k concurrent" },
  { name: "Intelligence plane", detail: "Repo graph, static analysis — scales with repo data" },
];

export function Architecture() {
  return (
    <section id="architecture" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-semibold text-cream">Built for scale, from day one</h2>
        <p className="mt-4 max-w-2xl text-slate">
          Four independently-scaling planes, event-driven end to end, designed for multi-region
          deployment and 10M users. Full architecture docs — C4 diagrams, database design, event
          schemas, and a disaster recovery plan — ship in the repo.
        </p>
        <div className="mt-10 space-y-px overflow-hidden rounded-lg border border-white/10">
          {planes.map((p, i) => (
            <div key={p.name} className="flex items-center gap-6 bg-white/5 px-6 py-5">
              <span className="font-mono text-sm text-kestrel-rust">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <p className="font-medium text-cream">{p.name}</p>
                <p className="text-sm text-slate">{p.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <a
          href="https://github.com"
          className="mt-6 inline-block font-mono text-sm text-kestrel-sky underline underline-offset-4"
        >
          Read the full architecture docs →
        </a>
      </div>
    </section>
  );
}
