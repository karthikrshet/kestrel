const tiers = [
  {
    name: "Self-hosted",
    price: "Free",
    detail: "MIT licensed",
    features: ["Full source code", "Bring your own LLM key", "Community support"],
  },
  {
    name: "Cloud (planned)",
    price: "Usage-based",
    detail: "Not yet available",
    features: ["Managed execution fleet", "Team dashboard", "SSO/SAML"],
  },
  {
    name: "Enterprise (planned)",
    price: "Contact us",
    detail: "Not yet available",
    features: ["Dedicated region/VPC", "Extended audit retention", "SLA"],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-white/10 px-6 py-24">
      <div className="mx-auto max-w-5xl">
        <h2 className="font-display text-3xl font-semibold text-cream">Pricing</h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div key={t.name} className="rounded-lg border border-white/10 p-8">
              <h3 className="font-display text-xl text-cream">{t.name}</h3>
              <p className="mt-2 font-mono text-2xl text-kestrel-rust">{t.price}</p>
              <p className="mt-1 text-xs text-slate">{t.detail}</p>
              <ul className="mt-6 space-y-2 text-sm text-slate">
                {t.features.map((f) => (
                  <li key={f}>— {f}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
