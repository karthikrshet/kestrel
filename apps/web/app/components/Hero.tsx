export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-white/10 px-6 py-28 md:py-36">
      <div className="pointer-events-none absolute right-[-10%] top-[-20%] h-[500px] w-[500px] rounded-full border border-kestrel-rust/20">
        <div className="sweep-line rounded-full" />
      </div>

      <div className="relative mx-auto max-w-4xl">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-kestrel-sky">
          v0.1 · open source · MIT licensed
        </p>
        <h1 className="font-display text-4xl font-semibold leading-[1.1] text-cream md:text-6xl">
          The Open-Source Autonomous Software Engineer
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate md:text-xl">
          Understand repositories, solve issues, write code, run tests, create pull requests, and
          accelerate software development with coordinated AI agents.
        </p>
        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href="#demo"
            className="rounded-md bg-kestrel-rust px-6 py-3 font-medium text-cream transition hover:bg-kestrel-rust/90"
          >
            Watch it work
          </a>
          <a
            href="https://github.com"
            className="rounded-md border border-white/15 px-6 py-3 font-medium text-cream transition hover:border-white/30"
          >
            View on GitHub
          </a>
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-8 border-t border-white/10 pt-8 font-mono text-sm md:grid-cols-4">
          <div>
            <dt className="text-slate">Concurrent runs (design target)</dt>
            <dd className="mt-1 text-xl text-cream">100,000</dd>
          </div>
          <div>
            <dt className="text-slate">Registered users (design target)</dt>
            <dd className="mt-1 text-xl text-cream">10M</dd>
          </div>
          <div>
            <dt className="text-slate">License</dt>
            <dd className="mt-1 text-xl text-cream">MIT</dd>
          </div>
          <div>
            <dt className="text-slate">Lighthouse target</dt>
            <dd className="mt-1 text-xl text-cream">95+</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
