import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kestrel.dev";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kestrel — The Open-Source Autonomous Software Engineer",
    template: "%s — Kestrel",
  },
  description:
    "Kestrel is an open-source platform for autonomous software engineering agents. Understand repositories, solve issues, write code, run tests, and open pull requests.",
  openGraph: {
    title: "Kestrel — The Open-Source Autonomous Software Engineer",
    description:
      "Understand repositories, solve issues, write code, run tests, create pull requests, and accelerate software development with coordinated AI agents.",
    url: siteUrl,
    siteName: "Kestrel",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Kestrel — The Open-Source Autonomous Software Engineer",
    description:
      "Understand repositories, solve issues, write code, run tests, create pull requests, and accelerate software development with coordinated AI agents.",
  },
  alternates: {
    canonical: siteUrl,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Kestrel",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Linux, macOS, Windows (via Docker)",
  description:
    "Open-source autonomous software engineering platform. Understands repositories, plans fixes, writes code, runs tests, and opens pull requests with human approval.",
  license: "https://opensource.org/licenses/MIT",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-body grain-bg">{children}</body>
    </html>
  );
}
