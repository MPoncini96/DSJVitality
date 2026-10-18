import type { MixedProvenance } from "@/lib/data";

const TEXT: Record<MixedProvenance, { label: string; title: string }> = {
  REAL: { label: "REAL", title: "From a public source. See /about for the citation." },
  SAMPLE: { label: "SAMPLE", title: "Simulated data (fixed seed). Not real figures for any school." },
  MIXED: { label: "PARTLY SAMPLE", title: "Combines public data with simulated data." },
};

/** Provenance badge. Shape + text + color, so it never relies on color alone. */
export function ProvenanceBadge({ p, className = "", compact = false }: { p: MixedProvenance; className?: string; compact?: boolean }) {
  const t = TEXT[p];
  const real = p === "REAL";
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
