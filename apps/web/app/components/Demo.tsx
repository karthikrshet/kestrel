const steps = [
  { cmd: "$ kestrel run --issue acme/webapp#412", out: "queued run 8f3a2c1..." },
  { cmd: "→ planning", out: "reproduce failing test, inspect payment service" },
  { cmd: "→ executing", out: "edited src/payments/refund.ts, ran test suite: 42/42 passed" },
  { cmd: "→ done", out: "opened PR #413, awaiting your review" },
];

export function Demo() {
  return (
    <section id="demo" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl font-semibold text-cream">See it work</h2>
        <div className="mt-8 overflow-hidden rounded-lg border border-white/10 bg-black/40 font-mono text-sm">
          <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-kestrel-rust/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
            <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
          </div>
          <div className="space-y-3 p-6">
            {steps.map((s) => (
              <div key={s.cmd}>
                <p className="text-cream">{s.cmd}</p>
                <p className="pl-2 text-slate">{s.out}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
