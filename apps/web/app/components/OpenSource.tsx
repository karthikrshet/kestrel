export function OpenSource() {
  return (
    <section id="open-source" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-5xl grid gap-10 md:grid-cols-2">
        <div>
          <h2 className="font-display text-3xl font-semibold text-cream">Open source, on purpose</h2>
          <p className="mt-4 text-slate">
            Kestrel is MIT-licensed and self-hostable. Bring your own LLM provider and API key —
            there's no lock-in to a single model vendor.
          </p>
        </div>
        <ul className="space-y-3 font-mono text-sm">
          <li className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate">License</span>
            <span className="text-cream">MIT</span>
          </li>
          <li className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate">Model support</span>
            <span className="text-cream">Anthropic, OpenAI, self-hosted</span>
          </li>
          <li className="flex justify-between border-b border-white/10 pb-3">
            <span className="text-slate">Deployment</span>
            <span className="text-cream">Docker, Kubernetes</span>
          </li>
          <li className="flex justify-between pb-3">
            <span className="text-slate">Contributing guide</span>
            <span className="text-cream">CONTRIBUTING.md</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
