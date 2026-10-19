import type { MixedProvenance } from "@/lib/data";

export type BadgeKind = MixedProvenance | "PROJECTED" | "UNVERIFIED";

const TEXT: Record<BadgeKind, { label: string; title: string }> = {
  PROJECTED: { label: "PROJECTED", title: "A forecast computed from real public data. Not a reported figure." },
  UNVERIFIED: { label: "UNVERIFIED", title: "From a third-party listing (e.g. Niche); not confirmed on the school's own site. Not used in any calculation." },
  REAL: { label: "REAL", title: "From a public source. See /about for the citation." },
  SAMPLE: { label: "SIMULATED", title: "Simulated data (fixed seed). Not real figures for any school." },
  MIXED: { label: "PARTLY SIMULATED", title: "Combines public data with simulated data." },
};

/** Provenance badge. Shape + text + color, so it never relies on color alone. */
export function ProvenanceBadge({ p, className = "", compact = false }: { p: BadgeKind; className?: string; compact?: boolean }) {
  const t = TEXT[p];
  const real = p === "REAL";
  if (p === "PROJECTED" || p === "UNVERIFIED") {
    return (
      <span title={t.title}
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap ${p === "PROJECTED" ? "border-accent text-accent" : "border-dotted border-faint text-muted"} ${className}`}>
        <span aria-hidden="true">{p === "PROJECTED" ? "↗" : "?"}</span>
        {compact ? <span className="sr-only">{t.label}</span> : t.label}
        <span className="sr-only">: {t.title}</span>
      </span>
    );
  }
  return (
    <span
      title={t.title}
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold tracking-wide whitespace-nowrap " +
        (real
          ? "border-real-border bg-real-bg text-real-fg"
          : "border-dashed border-sample-border bg-sample-bg text-sample-fg") +
        " " +
        className
      }
    >
      <span aria-hidden="true">{real ? "✓" : "◇"}</span>
      {compact ? <span className="sr-only">{t.label}</span> : t.label}
      <span className="sr-only">: {t.title}</span>
    </span>
  );
}
