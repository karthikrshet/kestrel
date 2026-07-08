const features = [
  {
    label: "Understand",
    title: "Repository intelligence",
    body: "Builds a dependency graph, flags security issues and dead code, and understands architecture before touching a line.",
  },
  {
    label: "Plan",
    title: "Multi-strategy reasoning",
    body: "Linear plans for simple fixes, Tree-of-Thoughts branching and debate frameworks for genuinely ambiguous ones.",
  },
  {
    label: "Remember",
    title: "Cross-run memory",
    body: "Episodic and semantic memory mean the agent doesn't relearn your test setup quirks on every single run.",
  },
  {
    label: "Execute",
    title: "Sandboxed, reversible",
    body: "Every tool call runs in an isolated microVM. Nothing merges without a human approval gate by default.",
  },
];

export function Features() {
  return (
    <section id="features" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-semibold text-cream">What it does</h2>
        <div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-white/10 bg-white/5 md:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="bg-ink p-8">
              <span className="font-mono text-xs uppercase tracking-[0.25em] text-kestrel-rust">
                {f.label}
              </span>
              <h3 className="mt-3 font-display text-xl font-medium text-cream">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
