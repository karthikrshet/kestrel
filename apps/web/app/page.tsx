import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
import { Architecture } from "./components/Architecture";
import { Demo } from "./components/Demo";
import { OpenSource } from "./components/OpenSource";
import { Roadmap } from "./components/Roadmap";
import { Testimonials } from "./components/Testimonials";
import { Pricing } from "./components/Pricing";
import { FAQ } from "./components/FAQ";

export default function HomePage() {
  return (
    <main>
      <Hero />
      <Features />
      <Architecture />
      <Demo />
      <OpenSource />
      <Roadmap />
      <Testimonials />
      <Pricing />
      <FAQ />
      <footer className="border-t border-white/10 px-6 py-10 text-center font-mono text-xs text-slate">
        Kestrel is open source under the MIT license. Not affiliated with any LLM provider.
      </footer>
    </main>
  );
}
