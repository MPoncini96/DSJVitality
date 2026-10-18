import Link from "next/link";
import type { MixedProvenance } from "@/lib/data";

/**
 * School references. Real school names are always shown. Anything that rests on
 * simulated data carries a SIMULATED badge or marker next to it instead.
 */

export function SchoolName({ name }: { id?: string; name: string }) {
  return <>{name}</>;
}

/** A school link in a risk context (alert, tier, Matrix, Turnaround). */
export function RiskSchoolRef({
  name, provenance, href,
}: { id: string; name: string; provenance: MixedProvenance; href?: string }) {
  const marker = provenance !== "REAL" && (
    <span className="ml-1 align-middle text-[10px] font-semibold tracking-wide text-sample-fg" title="Based at least partly on simulated data">
      ◇<span className="sr-only"> partly simulated</span>
    </span>
  );
  return href ? (
    <>
      <Link href={href} className="font-medium text-text underline decoration-border underline-offset-2 hover:decoration-accent">{name}</Link>
      {marker}
    </>
  ) : (
    <><span className="font-medium">{name}</span>{marker}</>
  );
}

export function SchoolLink({ id, name }: { id: string; name: string }) {
  return (
    <Link href={`/schools/${id}`} className="font-medium text-text underline decoration-border underline-offset-2 hover:decoration-accent">
      {name}
    </Link>
  );
}
