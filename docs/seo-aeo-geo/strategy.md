# SEO / AEO / GEO Strategy

Three related but distinct optimization targets for the marketing site (`apps/web`):

- **SEO (Search Engine Optimization):** ranking in traditional search (Google, Bing).
- **AEO (Answer Engine Optimization):** being the source an answer engine (Google's AI Overviews, Perplexity, Bing Copilot) quotes or cites directly in a synthesized answer.
- **GEO (Generative Engine Optimization):** being retrieved and referenced by LLM-based assistants (ChatGPT browsing, Claude web search, Gemini) when someone asks a question this site can answer.

These overlap but reward slightly different things, so the site is built to satisfy all three at once rather than picking one.

## Shared foundation (helps all three)

- **Fast, crawlable, server-rendered HTML.** Next.js App Router with static generation for the marketing pages — no critical content hidden behind client-side rendering that a crawler or a non-JS-executing bot might miss.
- **Semantic HTML structure.** Real `<h1>`–`<h3>` hierarchy, `<article>`/`<section>` landmarks, descriptive link text — this is also just good accessibility practice.
- **Structured data (JSON-LD).** `SoftwareApplication`, `Organization`, and `FAQPage` schema on the landing page (implemented in `apps/web/app/layout.tsx` and the FAQ component) — this is the single highest-leverage shared asset: it's what both classic rich-snippets and AI answer engines parse most reliably.
- **One canonical, well-written answer per question.** The FAQ section is written so each Q&A pair is a complete, self-contained, quotable answer (2-4 sentences) — exactly the shape both featured snippets and LLM citations prefer.

## SEO-specific

- Unique, descriptive `<title>` and meta description per page (`generateMetadata` in Next.js).
- `sitemap.xml` and `robots.txt` (see `apps/web/public/`).
- Open Graph + Twitter Card metadata for link previews.
- Internal linking between docs and landing page sections (e.g., "Architecture" section links to the full architecture docs on GitHub).
- Core Web Vitals: this is also the Lighthouse 95+ target from the performance section — SEO and performance work are the same work here.

## AEO-specific

- Content written to directly answer likely queries in the first sentence of a section ("Kestrel is an open-source platform for autonomous software engineering agents...") rather than burying the definition under marketing copy — answer engines extract the most direct sentence, so make that sentence exist and be accurate.
- Comparison-style content (Kestrel vs. running an LLM directly, vs. closed-source agents) structured as a clear table — tables are disproportionately likely to be lifted into synthesized answers.
- Data points and specific numbers (e.g., "supports 100,000 concurrent executions by design," Lighthouse targets) stated plainly and consistently across the site and docs, since answer engines cross-reference consistency as a trust signal.

## GEO-specific

- **`llms.txt`** at the site root (see `apps/web/public/llms.txt`) — an emerging convention giving LLM crawlers a concise, structured summary of what the project is and where to find canonical docs, analogous to `robots.txt` for crawlers but aimed at LLM ingestion.
- **Markdown-native docs** (this entire `/docs` folder) — plain Markdown in a public GitHub repo is very well represented in LLM training/retrieval corpora and is directly fetchable by browsing-capable assistants, more reliably than JS-rendered marketing pages.
- **Consistent, unambiguous project naming** ("Kestrel — Open-Source Autonomous Software Engineer") used identically across README, site title, and docs so that retrieval/attribution doesn't fragment across variant names.
- **Permissive licensing stated clearly (MIT)** — GEO-driven citation and adoption both benefit from an assistant being able to state licensing terms confidently when asked "can I use this."

## Measurement

- Classic SEO: Search Console (impressions, CTR, ranking position).
- AEO: manual/periodic spot-checks of target queries in Google AI Overviews and Bing Copilot, tracked in a simple log (no reliable API for this yet as of this writing).
- GEO: monitor referral traffic with a `?ref=` pattern on any links included in `llms.txt` and docs, plus periodic manual queries to major assistants to check whether/how the project is described.
