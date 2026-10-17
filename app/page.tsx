import Link from "next/link";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { SchoolsTable, type SchoolTableRow } from "@/components/SchoolsTable";
import { TrendChart } from "@/components/TrendChart";
import {
  GOVERNANCE_LABEL, consecutiveDeclines, enrollmentTotals, getSchools, getTuition, median, provenanceOf,
  systemTrend, type MixedProvenance, type SchoolScope,
} from "@/lib/data";

const LATEST = 2025;

function Kpi({
  label, value, sub, p,
}: { label: string; value: string; sub?: string; p: MixedProvenance }) {
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

export default async function Overview({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const scope: SchoolScope = (await searchParams).scope === "all" ? "all" : "default";
  const schools = getSchools(scope);
  const ids = schools.map((s) => s.id);

  const trend = systemTrend(ids);
  const latest = trend.find((t) => t.year === LATEST);
  const prior = trend.find((t) => t.year === LATEST - 1);
  const yoy = latest && prior ? (latest.total - prior.total) / prior.total : null;

  const totals = enrollmentTotals(ids);
  const bySchool = new Map<string, typeof totals>();
  for (const t of totals) (bySchool.get(t.schoolId) ?? bySchool.set(t.schoolId, []).get(t.schoolId)!).push(t);
  const declining = [...bySchool.values()].filter((s) => consecutiveDeclines(s) >= 3).length;
  const enrollmentP = provenanceOf(totals.map((t) => ({ provenance: t.provenance === "REAL" ? "REAL" : "SAMPLE" })));

  const tuitionLatest = getTuition().filter((t) => t.year === LATEST && ids.includes(t.schoolId) && t.tuition !== null);
  const medTuition = median(tuitionLatest.map((t) => t.tuition!));

  const rows: SchoolTableRow[] = schools.map((s) => {
    const series = (bySchool.get(s.id) ?? []).sort((a, b) => a.year - b.year);
    const last = series.find((x) => x.year === LATEST);
    const five = series.find((x) => x.year === LATEST - 5);
    return {
      id: s.id,
      name: s.name,
      city: s.city,
      type: GOVERNANCE_LABEL[s.governance],
      latest: last?.total ?? null,
      change5: last && five ? (last.total - five.total) / five.total : null,
      spark: series.map((x) => x.total),
      provenance: provenanceOf(series.map((x) => ({ provenance: x.provenance === "REAL" ? "REAL" : "SAMPLE" }))),
    };
  });

  const allSample = enrollmentP !== "REAL";

  return (
    <div className="space-y-8">
      <section aria-labelledby="title" className="space-y-2">
        <h1 id="title" className="text-2xl font-semibold tracking-tight">System overview</h1>
        <p className="max-w-3xl text-sm text-muted">
          Operational health across Catholic elementary schools in Santa Clara County, organized around the duties of a
          school operational-vitality role: finance, enrollment, systems, and facilities.
        </p>
      </section>

      {allSample && (
        <div role="note" className="sample-edge rounded-xl border border-sample-border bg-sample-bg px-4 py-3 text-sm text-sample-fg">
          <strong className="font-semibold">Most numbers on this page are SAMPLE data.</strong> They are simulated with a
          fixed seed to show how the dashboard works, and are not real figures for any school. Anything marked{" "}
          <ProvenanceBadge p="SAMPLE" /> is simulated; <ProvenanceBadge p="REAL" /> comes from a cited public source. School
          names are hidden by default while enrollment is simulated.
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Which schools to include">
        <span className="text-muted">Showing:</span>
        <Link
          href="/"
          aria-current={scope === "default" ? "page" : undefined}
          className={`rounded-full border px-3 py-1 ${scope === "default" ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2"}`}
        >
          25 parish elementary schools
        </Link>
        <Link
          href="/?scope=all"
          aria-current={scope === "all" ? "page" : undefined}
          className={`rounded-full border px-3 py-1 ${scope === "all" ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2"}`}
        >
          All 33 listed schools
        </Link>
      </div>

      <section aria-label="Key figures" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Schools" value={String(schools.length)} sub="from the public school directory" p="REAL" />
        <Kpi
          label="Total enrollment, 2025-26"
          value={latest ? latest.total.toLocaleString() : "—"}
          sub={yoy === null ? undefined : `${yoy > 0 ? "+" : yoy < 0 ? "\u2212" : ""}${Math.abs(yoy * 100).toFixed(1)}% vs 2024-25`}
          p={enrollmentP}
        />
        <Kpi label="Schools with 3+ years of decline" value={String(declining)} sub={`of ${schools.length}`} p={enrollmentP} />
        <Kpi
          label="Median tuition, 2025-26"
          value={medTuition === null ? "—" : `$${Math.round(medTuition).toLocaleString()}`}
          sub={`${tuitionLatest.length} schools reporting`}
          p={provenanceOf(tuitionLatest)}
        />
      </section>

      <section aria-labelledby="trend-h" className={`rounded-xl border border-border bg-surface p-5 ${allSample ? "sample-edge" : ""}`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="trend-h" className="text-sm font-semibold">System enrollment, 2016-17 to 2025-26</h2>
          <ProvenanceBadge p={enrollmentP} />
        </div>
        <TrendChart data={trend} label="System enrollment" />
      </section>

      <section aria-labelledby="table-h" className="space-y-3">
        <h2 id="table-h" className="text-sm font-semibold">Schools</h2>
        <SchoolsTable rows={rows} />
      </section>
    </div>
  );
}
