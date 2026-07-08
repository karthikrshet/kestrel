const faqs = [
  {
    q: "What is Kestrel?",
    a: "Kestrel is an open-source platform for autonomous software engineering agents. It reads a repository and an issue, plans a fix, writes code, runs tests, and opens a pull request, with a human approval step before anything merges.",
  },
  {
    q: "Is Kestrel free?",
    a: "Yes. Kestrel is MIT-licensed and free to self-host. You bring your own LLM provider API key, so the only cost is your model usage.",
  },
  {
    q: "Which LLM providers does it support?",
    a: "Kestrel is model-agnostic. It currently supports Anthropic and OpenAI models, plus self-hosted models via a compatible API, configured through a single environment variable.",
  },
  {
    q: "Does Kestrel merge code automatically?",
    a: "No, not by default. Kestrel opens a pull request and waits for a human approval gate before anything merges. Autonomous merging is not part of the default configuration.",
  },
  {
    q: "How is this different from just prompting an LLM directly?",
    a: "Kestrel adds repository-scale context (a dependency graph, not just the files in view), persistent memory across runs, sandboxed execution with real test runs, and a structured plan-execute-reflect loop, rather than a single unstructured prompt.",
  },
  {
    q: "Can it handle large, million-line-of-code repositories?",
    a: "Kestrel's repository intelligence engine indexes incrementally, chunked by module, and re-indexes only changed files after the first pass, which is designed specifically to make large repositories tractable. See the engine design doc for details.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

export function FAQ() {
  return (
    <section id="faq" className="px-6 py-24">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <div className="mx-auto max-w-3xl">
        <h2 className="font-display text-3xl font-semibold text-cream">Frequently asked questions</h2>
        <div className="mt-10 space-y-8">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="font-medium text-cream">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate">{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
