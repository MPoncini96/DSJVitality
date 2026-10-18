import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ThemeToggle, themeInitScript } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "School Vitality Prototype",
  description:
    "Independent prototype dashboard of operational health for Catholic elementary schools in Santa Clara County. Not affiliated with or endorsed by the Diocese of San José.",
};

const NAV = [
  { href: "/", label: "Radar", ready: true },
  { href: "/alerts", label: "Alerts", ready: true },
  { href: "/turnaround", label: "Turnaround", ready: true },
  { href: "/enrollment", label: "Enrollment", ready: false },
  { href: "/finance", label: "Finance", ready: false },
  { href: "/facilities", label: "Facilities", ready: false },
  { href: "/systems", label: "Systems", ready: false },
  { href: "/calendar", label: "Calendar", ready: false },
  { href: "/about", label: "About", ready: false },
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
                      {n.ready ? (
                        <Link href={n.href} className="rounded-md px-2 py-1.5 whitespace-nowrap text-text hover:bg-surface-2">
                          {n.label}
                        </Link>
                      ) : (
                        <span className="cursor-default rounded-md px-2 py-1.5 whitespace-nowrap text-faint" title="Coming next">
                          {n.label}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="ml-auto flex items-center gap-2">
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
      </body>
    </html>
  );
}
