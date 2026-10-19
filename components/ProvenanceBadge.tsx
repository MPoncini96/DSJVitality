import type { MixedProvenance } from "@/lib/data";

export type BadgeKind = MixedProvenance | "PROJECTED" | "UNVERIFIED";

/**
 * One convention for provenance:
 *   REAL        renders normally, with its source cited in the card. No badge.
 *   SIMULATED   hatched card background plus one small "Simulated" tag in the card header.
 *   PROJECTED / UNVERIFIED  a small text note, not a pill.
 */
export function SimTag({ className = "" }: { className?: string }) {
  return (
    <span title="Simulated data for a fictional school (fixed seed). Not a real figure for any school."
      className={`inline-flex items-center gap-1 rounded border border-dashed border-sample-border bg-sample-bg px-1.5 py-px text-[11px] font-semibold text-sample-fg ${className}`}>
      <span aria-hidden="true">◇</span>Simulated
    </span>
  );
}

const NOTE: Record<"PROJECTED" | "UNVERIFIED", { text: string; title: string }> = {
  PROJECTED: { text: "Scenario, not a forecast", title: "A range computed from real public data. Not a reported figure and not a prediction." },
  UNVERIFIED: { text: "Unverified", title: "From a third-party listing; not confirmed on the school's own site. Not used in any calculation." },
};

export function ProvenanceNote({ p, className = "" }: { p: "PROJECTED" | "UNVERIFIED"; className?: string }) {
  return <span title={NOTE[p].title} className={`text-xs italic text-muted ${className}`}>{NOTE[p].text}</span>;
}

/** Card-header marker for a given provenance; nothing for REAL. */
export function ProvenanceBadge({ p, className = "" }: { p: BadgeKind; className?: string }) {
  if (p === "REAL") return null;
  if (p === "PROJECTED" || p === "UNVERIFIED") return <ProvenanceNote p={p} className={className} />;
  return <SimTag className={className} />;
}
