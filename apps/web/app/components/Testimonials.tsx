// Kestrel is pre-launch — there are no real user quotes yet. Rather than fabricate
// attributed testimonials, this section states that plainly and shows the use cases
// the project is designed for. Swap this component out for real quotes once available.

const useCases = [
  {
    title: "Triage the backlog",
    body: "Point Kestrel at a label like `agent-ready` and let it draft PRs for the small, well-defined issues piling up.",
  },
  {
    title: "Understand a new repo fast",
    body: "Run the repository intelligence engine on a codebase you just inherited to get a dependency graph and a tech-debt report before your first standup.",
  },
  {
    title: "Keep dependencies current",
    body: "Let the agent handle routine dependency bumps end-to-end, including fixing the type errors they cause.",
  },
];

export function Testimonials() {
  return (
    <section id="testimonials" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-semibold text-cream">Built for real workflows</h2>
        <p className="mt-3 text-sm text-slate">
          Kestrel is early-stage — we don't have customer quotes to share yet. Here's what it's
          designed to be good at.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {useCases.map((u) => (
            <div key={u.title} className="rounded-lg border border-white/10 p-6">
              <h3 className="font-display text-lg text-cream">{u.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{u.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
