import type { ReactNode } from "react";
import { ProvenanceBadge } from "./ProvenanceBadge";
import type { MixedProvenance } from "@/lib/data";
import type { Severity } from "@/lib/radar";
import type { Quadrant, Tier } from "@/lib/health";

export function Card({
  title, p, children, className = "", action, id,
}: { title?: ReactNode; p?: MixedProvenance; children: ReactNode; className?: string; action?: ReactNode; id?: string }) {
  const sample = p !== undefined && p !== "REAL";
  return (
    <section aria-labelledby={id} className={`rounded-xl border border-border bg-surface p-5 ${sample ? "sample-edge" : ""} ${className}`}>
      {(title || p) && (
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

export function Stat({ label, value, sub, p }: { label: string; value: ReactNode; sub?: ReactNode; p: MixedProvenance }) {
  const sample = p !== "REAL";
  return (
    <div className={`rounded-xl border border-border bg-surface p-4 ${sample ? "sample-edge" : ""}`}>
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
  warning: { icon: "●", label: "Watch", color: "var(--warning)" },
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
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-text"
      style={{ borderColor: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
    >
      <span aria-hidden="true" style={{ color: c }}>{QUADRANT_ICON[t as Quadrant]}</span>
      {t}
    </span>
  );
}

export function Illustrative() {
  return (
    <span className="rounded border border-dashed border-sample-border px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-sample-fg">
      ILLUSTRATIVE
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

export function SampleBanner() {
  return (
    <div role="note" className="sample-edge rounded-xl border border-sample-border bg-sample-bg px-4 py-3 text-sm text-sample-fg">
      <strong className="font-semibold">Most numbers here are SAMPLE data.</strong> They are simulated with a fixed seed to show
      how the dashboard works and are not real figures for any school. <ProvenanceBadge p="SAMPLE" /> is simulated;{" "}
      <ProvenanceBadge p="REAL" /> comes from a cited public source. Risk flags built on SAMPLE data never appear next to a
      real school name.
    </div>
  );
}
