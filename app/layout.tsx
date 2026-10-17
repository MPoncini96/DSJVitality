import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { AnonymizeToggle, NamesProvider } from "@/components/Names";
import { ThemeToggle, themeInitScript } from "@/components/ThemeToggle";
import { anonymousLabels, getEnrollment, getSchools, provenanceOf } from "@/lib/data";

export const metadata: Metadata = {
  title: "School Vitality Prototype",
  description:
    "Independent prototype dashboard of operational health for Catholic elementary schools in Santa Clara County. Not affiliated with or endorsed by the Diocese of San José.",
};

const NAV = [
  { href: "/", label: "Overview", ready: true },
  { href: "/enrollment", label: "Enrollment", ready: false },
  { href: "/finance", label: "Finance", ready: false },
  { href: "/facilities", label: "Facilities", ready: false },
  { href: "/systems", label: "Systems", ready: false },
  { href: "/about", label: "About", ready: false },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const labels = anonymousLabels(getSchools("all"));
  // Names default to hidden unless every enrollment row is REAL.
  const defaultAnonymize = provenanceOf(getEnrollment()) !== "REAL";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen">
        <NamesProvider labels={labels} defaultAnonymize={defaultAnonymize}>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
            Skip to content
          </a>
          <header className="border-b border-border bg-surface">
            <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-[15px] font-semibold tracking-tight">School Vitality</span>
                <span className="text-xs text-muted">independent prototype</span>
              </Link>
              <nav aria-label="Main" className="order-3 w-full overflow-x-auto sm:order-none sm:w-auto">
                <ul className="flex gap-1 text-sm">
                  {NAV.map((n) => (
                    <li key={n.href}>
                      {n.ready ? (
                        <Link href={n.href} className="rounded-md px-2.5 py-1.5 text-text hover:bg-surface-2">
                          {n.label}
                        </Link>
                      ) : (
                        <span className="cursor-default rounded-md px-2.5 py-1.5 text-faint" title="Coming in Phase 2">
                          {n.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="ml-auto flex items-center gap-2">
                <AnonymizeToggle />
                <ThemeToggle />
              </div>
            </div>
          </header>

          <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            {children}
          </main>

          <footer className="mt-12 border-t border-border">
            <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted sm:px-6">
              Independent prototype by Matthew Poncini. Not affiliated with or endorsed by the Diocese of San José.
            </div>
          </footer>
        </NamesProvider>
      </body>
    </html>
  );
}
