import type { ReactNode } from "react";
import { ProvenanceBadge, type BadgeKind } from "./ProvenanceBadge";
import type { Severity } from "@/lib/radar";
import type { Quadrant, Tier } from "@/lib/health";

export function Card({
  title, p, children, className = "", action, id,
}: { title?: ReactNode; p?: BadgeKind; children: ReactNode; className?: string; action?: ReactNode; id?: string }) {
  const sample = p === "SAMPLE" || p === "MIXED";
  return (
    <section aria-labelledby={id} data-simulated={sample ? "true" : undefined}
      className={`min-w-0 rounded-xl border border-border bg-surface p-5 ${sample ? "sample-edge" : ""} ${className}`}>
      {(title || (p && p !== "REAL")) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 id={id} className="text-sm font-semibold">{title}</h2>}
          <div className="flex items-center gap-2">
            {action}
            {p && <ProvenanceBadge p={p} />}
          </div>
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, p }: { label: string; value: ReactNode; sub?: ReactNode; p: BadgeKind }) {
  const sample = p === "SAMPLE" || p === "MIXED";
  return (
    <div data-simulated={sample ? "true" : undefined} className={`rounded-xl border border-border bg-surface p-4 ${sample ? "sample-edge" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted">{label}</div>
        <ProvenanceBadge p={p} />
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted tabular">{sub}</div>}
    </div>
  );
}

const SEV: Record<Severity, { icon: string; label: string; color: string }> = {
  critical: { icon: "▲", label: "Critical", color: "var(--critical)" },
  serious: { icon: "◆", label: "Serious", color: "var(--serious)" },
  warning: { icon: "●", label: "Watch item", color: "var(--warning)" },
};

/** Severity pill: icon + label + color, never color alone. */
export function SeverityPill({ s }: { s: Severity }) {
  const v = SEV[s];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text"
      style={{ borderColor: v.color, background: `color-mix(in srgb, ${v.color} 14%, transparent)` }}
    >
      <span aria-hidden="true" style={{ color: v.color }}>{v.icon}</span>
      {v.label}
    </span>
  );
}

export const QUADRANT_COLOR: Record<Quadrant, string> = {
  Stable: "var(--good)",
  Watch: "var(--warning)",
  "Growth opportunity": "var(--series-1)",
  "Turnaround candidate": "var(--critical)",
};
const QUADRANT_ICON: Record<Quadrant, string> = { Stable: "✓", Watch: "●", "Growth opportunity": "↗", "Turnaround candidate": "▲" };

export function TierPill({ t }: { t: Tier | Quadrant | null }) {
  if (!t) return <span className="text-faint">—</span>;
  const c = QUADRANT_COLOR[t as Quadrant];
  return (
    <span data-band={t}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text"
      style={{ borderColor: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
    >
      <span aria-hidden="true" style={{ color: c }}>{QUADRANT_ICON[t as Quadrant]}</span>
      {t}
    </span>
  );
}

export function PageHeader({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {sub && <p className="max-w-3xl text-sm text-muted">{sub}</p>}
      {children}
    </div>
  );
}

/** Sits at the top of every page about the fictional demo system. */
export function DemoNote({ children }: { children?: ReactNode }) {
  return (
    <div role="note" data-simulated="true" className="sample-edge rounded-xl border border-sample-border bg-sample-bg px-4 py-3 text-sm text-sample-fg">
      <strong className="font-semibold">Demo system: fictional schools, simulated data.</strong>{" "}
      {children ?? <>School A through School Y are invented. They are not stand-ins for any real school, and none of their numbers describe a real school. They show how the dashboard works once internal data (budgets, assistance, facilities, admissions) is connected.</>}
    </div>
  );
}
