import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { SlimBar } from "@/components/SlimBar";
import { ThemeToggle, themeInitScript } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "School Vitality Prototype",
  description:
    "Independent prototype dashboard of operational health for Catholic elementary schools in Santa Clara County, built with public data. Not affiliated with or endorsed by the Diocese of San José.",
};

const NAV = [
  { href: "/", label: "Radar" },
  { href: "/alerts", label: "Alerts" },
  { href: "/turnaround", label: "Turnaround" },
  { href: "/strategies", label: "Strategies" },
  { href: "/demo", label: "Demo schools" },
  { href: "/about", label: "About the data" },
  { href: "/about-me", label: "Why I built this" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
            Skip to content
          </a>
          <header className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 sm:px-6 lg:flex-nowrap">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-[15px] font-semibold tracking-tight">School Vitality</span>
                <span className="hidden text-xs text-muted xl:inline">independent prototype</span>
              </Link>
              <nav aria-label="Main" className="order-3 w-full overflow-x-auto lg:order-none lg:w-auto lg:flex-1">
                <ul className="flex gap-0.5 text-sm">
                  {NAV.map((n) => (
                    <li key={n.href}>
                      <Link href={n.href} className={`block rounded-md px-2 py-1.5 whitespace-nowrap hover:bg-surface-2 ${n.href === "/about-me" ? "font-semibold text-accent" : "text-text"}`}>
                        {n.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
              </div>
            </div>
          </header>
          <SlimBar />

          <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </main>

          <footer className="mt-12 border-t border-border">
            <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6">
              Independent prototype by Matthew Poncini. Not affiliated with or endorsed by the Diocese of San José.
            </div>
          </footer>
      </body>
    </html>
  );
}
