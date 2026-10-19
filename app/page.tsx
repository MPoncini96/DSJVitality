import Link from "next/link";
import { MatrixChart, type MatrixPoint } from "@/components/charts";
import { AreaTiles, ScopeToggle, groupBySchool } from "@/components/alerts";
import { RiskSchoolRef } from "@/components/Names";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { SchoolsTable, type SchoolTableRow } from "@/components/SchoolsTable";
import { TrendChart } from "@/components/TrendChart";
import { Card, Illustrative, PageHeader, SampleBanner, Stat } from "@/components/ui";
import { upcoming } from "@/lib/calendar";
import { GOVERNANCE_LABEL, getCountyBirths, getTuition, median, provenanceOf, systemTrend, type SchoolScope } from "@/lib/data";
import { SimpleLine } from "@/components/charts";
import { dateLong, dateShort, money, schoolYear, signedPct } from "@/lib/format";
import { AS_OF } from "@/lib/metrics";
import { systemView } from "@/lib/system";

export default async function Radar({ searchParams }: { searchParams: Promise<{ scope?: string }> }) {
  const sp = await searchParams;
  const scope: SchoolScope = sp.scope === "all" ? "all" : "default";
  const views = systemView(scope);
  const ids = views.map((v) => v.school.id);
  const allAlerts = views.flatMap((v) => v.alerts);
  const groups = groupBySchool(allAlerts);
  const urgentSchools = groups.filter(([, al]) => al[0].severity !== "warning").length;
  const criticalSchools = groups.filter(([, al]) => al[0].severity === "critical").length;

  // System figures
  const trend = systemTrend(ids);
  const L = trend.at(-1)?.year ?? 0;
  const latest = trend.at(-1), prior = trend.at(-2);
  const yoy = latest && prior ? latest.total / prior.total - 1 : null;
  const enrollP = provenanceOf(trend.map((t) => ({ provenance: t.provenance === "REAL" ? "REAL" : "SAMPLE" })));
  // Published tuition: REAL rows only, latest year (2026-27). Unverified listings are never included.
  const tuitionReal = getTuition().filter((t) => t.provenance === "REAL" && ids.includes(t.schoolId) && t.tuition !== null);
  const tuitionYear = tuitionReal.length ? Math.max(...tuitionReal.map((t) => t.year)) : L;
  const tuitionL = tuitionReal.filter((t) => t.year === tuitionYear);
  // Projections: system total = sum of each school's projection (REAL inputs only), shown only when every school has one.
  const projected = views.map((v) => v.metrics.projection).filter((p) => p.years.length && p.inputs === "REAL");
  const projYear = projected.length === views.length ? Math.min(...projected.map((p) => p.years.at(-1)!.year)) : null;
  const projTotal = projYear ? projected.reduce((a, p) => a + (p.years.find((y) => y.year === projYear)?.total ?? 0), 0) : null;
  const county = getCountyBirths();
  const peak = county.reduce((a, b) => (b.births > a.births ? b : a), county[0]);
  const lastBirth = county.at(-1);
  const reRates = views.map((v) => v.metrics.reenrollment.rate).filter((x): x is number => x !== null);

  const matrix: MatrixPoint[] = views
    .filter((v) => v.health.quadrant && v.metrics.enrollment.cagr5 !== null && v.health.financial.score !== null)
    .map((v) => ({
      id: v.school.id, name: v.school.name, x: v.metrics.enrollment.cagr5!, y: v.health.financial.score!, quadrant: v.health.quadrant!,
      provenance: provenanceOf([v.metrics.enrollment, v.health.financial].map((x) => ({ provenance: x.provenance === "REAL" ? "REAL" : "SAMPLE" }))),
    }));
  const matrixP = provenanceOf(matrix.map((m) => ({ provenance: m.provenance === "REAL" ? "REAL" : "SAMPLE" })));
  const qCount = (q: string) => matrix.filter((m) => m.quadrant === q).length;

  const rows: SchoolTableRow[] = views.map((v) => {
    const s = v.metrics.enrollment.series;
    const five = s.find((x) => x.year === L - 5)?.total;
    return {
      id: v.school.id, name: v.school.name, city: v.school.city, type: GOVERNANCE_LABEL[v.school.governance],
      latest: v.metrics.enrollment.latest, change5: v.metrics.enrollment.latest && five ? v.metrics.enrollment.latest / five - 1 : null,
      spark: s.map((x) => x.total), provenance: v.metrics.enrollment.provenance,
    };
  });

  const checkins = views.filter((v) => v.turnaround).sort((a, b) => a.turnaround!.nextCheckin.localeCompare(b.turnaround!.nextCheckin));
  const alertsHref = scope === "all" ? "/alerts?scope=all" : "/alerts";

  return (
    <div className="space-y-8">
      <PageHeader title="Radar" sub={<>The state of {views.length} schools as of {dateLong(AS_OF)}: where they stand, what is coming up, and where to look first.</>}>
        <ScopeToggle base="/" scope={scope} />
      </PageHeader>

      <SampleBanner />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Schools" value={String(views.length)} sub="from the public school directory" p="REAL" />
        <Stat label={`Enrollment, ${schoolYear(L)}`} value={latest ? latest.total.toLocaleString() : "—"} sub={`${signedPct(yoy)} vs ${schoolYear(L - 1)}`} p={enrollP} />
        {projYear && latest ? (
          <Stat label={`Projected enrollment, ${schoolYear(projYear)}`} value={projTotal!.toLocaleString()} sub={`${signedPct(projTotal! / latest.total - 1)} vs ${schoolYear(L)}, from births already on record`} p="PROJECTED" />
        ) : (
          <Stat label="Median re-enrollment" value={reRates.length ? `${Math.round(median(reRates)! * 100)}%` : "—"} sub="families returning this fall" p={provenanceOf(views.map((v) => ({ provenance: v.metrics.reenrollment.provenance === "REAL" ? "REAL" : "SAMPLE" })))} />
        )}
        <Stat label={`Median published tuition, ${schoolYear(tuitionYear)}`} value={money(median(tuitionL.map((t) => t.tuition!)))} sub={`standard rate; ${tuitionL.length} of ${views.length} schools post a ${schoolYear(tuitionYear)} rate`} p={tuitionL.length ? "REAL" : "SAMPLE"} />
      </div>

      <section aria-labelledby="att-h" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="att-h" className="text-lg font-semibold tracking-tight">Alerts</h2>
          <Link href={alertsHref} className="text-sm text-accent underline underline-offset-2">
            {urgentSchools} schools need attention{criticalSchools ? `, ${criticalSchools} critical` : ""} →
          </Link>
        </div>
        <AreaTiles alerts={allAlerts} scope={scope} />
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" id="matrix-h" p={matrixP} title={<>Enrollment &amp; Finance Matrix {matrixP !== "REAL" && <Illustrative />}</>}>
          <p className="mb-3 text-sm text-muted">
            Each dot is a school: five-year enrollment trend across, financial score up. Shrinking schools with weak finances
            (bottom left) are Turnaround Program candidates. {qCount("Turnaround candidate")} in that quadrant,{" "}
            {qCount("Watch")} to watch, {qCount("Growth opportunity")} growing but financially weak, {qCount("Stable")} stable.
          </p>
          <MatrixChart points={matrix} />
        </Card>

        <div className="space-y-6">
          <Card title="Coming up" id="cal-h">
            <ul className="space-y-3">
              {upcoming(AS_OF).map((c) => (
                <li key={c.title} className="text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{c.title}</span>
                    <ProvenanceBadge p={c.provenance} />
                  </div>
                  <div className="text-xs text-muted tabular">
                    {dateShort(c.start)}{c.end !== c.start ? ` – ${dateShort(c.end)}` : ""} · {c.area}
                  </div>
                  {c.source && <a className="text-xs text-accent underline underline-offset-2" href={c.source}>Source</a>}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">Items marked SIMULATED are typical timings, to be confirmed with the Department of Catholic Schools.</p>
          </Card>

          <Card title="Turnaround check-ins" id="ta-h" p={provenanceOf(checkins.map((c) => c.turnaround!))}
            action={<Link href="/turnaround" className="text-xs text-accent underline underline-offset-2">Program</Link>}>
            {checkins.length === 0 ? <p className="text-sm text-muted">No schools in the program for this view.</p> : (
              <ul className="space-y-2 text-sm">
                {checkins.map((v) => (
                  <li key={v.school.id} className="flex items-center justify-between gap-2">
                    <RiskSchoolRef id={v.school.id} name={v.school.name} provenance={v.turnaround!.provenance} href={`/schools/${v.school.id}`} />
                    <span className="text-xs text-muted tabular">{v.turnaround!.phase} · {dateShort(v.turnaround!.nextCheckin)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <section aria-labelledby="sys-h" className="space-y-4">
        <h2 id="sys-h" className="text-lg font-semibold tracking-tight">Enrollment</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={`System enrollment, ${schoolYear(trend[0]?.year ?? 0)} to ${schoolYear(L)}`} p={enrollP} id="trend-h">
            <TrendChart data={trend} label="System enrollment" />
          </Card>
          {county.length > 0 && (
            <Card title="Births in Santa Clara County" p="REAL" id="births-h">
              <SimpleLine rows={county.map((c) => ({ x: String(c.birthYear).slice(2), y: c.births }))} format="number" label="Births by year, county ZIPs" sample={false} />
              <p className="text-xs text-muted">
                {lastBirth!.births.toLocaleString()} in {lastBirth!.birthYear}, {signedPct(lastBirth!.births / peak.births - 1)} from the {peak.birthYear} peak.
                Children born in {lastBirth!.birthYear} start kindergarten in {schoolYear(lastBirth!.birthYear + 5)}. Source: CDPH via CHHS Open Data.
              </p>
            </Card>
          )}
        </div>
        <SchoolsTable rows={rows} latestLabel={`Enrollment ${schoolYear(L)}`} />
      </section>
    </div>
  );
}
