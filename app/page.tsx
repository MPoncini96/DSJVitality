import Link from "next/link";
import { MatrixChart, SimpleLine, type MatrixPoint } from "@/components/charts";
import { SchoolLink } from "@/components/Names";
import { SchoolsTable, type SchoolTableRow } from "@/components/SchoolsTable";
import { stateDataLabel } from "@/components/school";
import { CheckinDate, ComingUp } from "@/components/Today";
import { TrendChart } from "@/components/TrendChart";
import { Card, PageHeader, SeverityPill, Stat } from "@/components/ui";
import { nextCdeRelease } from "@/lib/calendar";
import { BASE_YEAR, CDE_PUBLISHED, DEMO_AS_OF } from "@/lib/config";
import { getCountyBirths, getTuition, latestEnrollmentYear, median, systemTrend } from "@/lib/data";
import { dateLong, money, schoolYear, signedPct } from "@/lib/format";
import { displayName } from "@/lib/names";
import { demoView, rankUrgent, realView } from "@/lib/system";

export default function Radar() {
  const views = realView();
  const ids = views.map((v) => v.school.id);
  const urgent = rankUrgent(views);
  const top = urgent.slice(0, 5);

  // System figures (all REAL)
  const trend = systemTrend(ids);
  const L = latestEnrollmentYear();
  const latest = trend.at(-1), prior = trend.at(-2), base = trend.find((t) => t.year === BASE_YEAR);
  const yoy = latest && prior ? latest.total / prior.total - 1 : null;
  // Published tuition: school-published, year stated, latest rate year. Unverified and undated rows are excluded.
  const tuitionReal = getTuition().filter((t) => t.provenance === "REAL" && t.yearStated && ids.includes(t.schoolId) && t.tuition !== null);
  const tuitionYear = tuitionReal.length ? Math.max(...tuitionReal.map((t) => t.year)) : L;
  const tuitionL = tuitionReal.filter((t) => t.year === tuitionYear);
  // System scenario range: sum of each school's low and high for the last year every school reaches.
  const scen = views.map((v) => v.metrics.scenario).filter((s) => s.years.length && s.inputs === "REAL");
  const scYear = scen.length === views.length ? Math.min(...scen.map((s) => s.years.at(-1)!.year)) : null;
  const scLow = scYear ? scen.reduce((a, s) => a + s.years.find((y) => y.year === scYear)!.low, 0) : null;
  const scHigh = scYear ? scen.reduce((a, s) => a + s.years.find((y) => y.year === scYear)!.high, 0) : null;
  const county = getCountyBirths();
  const peak = county.reduce((a, b) => (b.births > a.births ? b : a), county[0]);
  const lastBirth = county.at(-1);

  const rows: SchoolTableRow[] = views.map((v) => ({
    id: v.school.id, name: displayName(v.school, "REAL"), city: v.school.city, type: "Parish elementary",
    latest: v.metrics.enrollment.latest, change5: v.metrics.enrollment.changeSinceBase,
    spark: v.metrics.enrollment.series.map((x) => x.total),
    title: v.school.formerNames.length ? `Also listed as: ${v.school.formerNames.join("; ")}` : undefined,
  }));

  // Demo system (fictional schools, simulated data)
  const demo = demoView();
  const matrix: MatrixPoint[] = demo
    .filter((v) => v.health.quadrant && v.metrics.enrollment.cagr !== null && v.health.financial?.score != null)
    .map((v) => ({ id: v.school.id, name: displayName(v.school, "SAMPLE"), x: v.metrics.enrollment.cagr!, y: v.health.financial!.score!, quadrant: v.health.quadrant! }));
  const qCount = (q: string) => matrix.filter((m) => m.quadrant === q).length;
  const checkins = demo.filter((v) => v.turnaround).sort((a, b) => a.turnaround!.nextCheckin.localeCompare(b.turnaround!.nextCheckin));
  const tierCount = (t: string) => demo.filter((v) => v.health.composite?.tier === t).length;

  return (
    <div className="space-y-8">
      <PageHeader title="Radar" sub={<>The {views.length} parish elementary schools in Santa Clara County: where enrollment stands, what is coming up, and where to look first. {stateDataLabel(CDE_PUBLISHED)}.</>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Schools" value={String(views.length)} sub="parish elementary, from the public school directory" p="REAL" />
        <Stat label={`Enrollment, ${schoolYear(L)}`} value={latest ? latest.total.toLocaleString() : "—"}
          sub={`${signedPct(yoy)} vs ${schoolYear(L - 1)}; ${signedPct(latest && base ? latest.total / base.total - 1 : null)} since ${schoolYear(BASE_YEAR)}`} p="REAL" />
        {scYear && scLow && scHigh ? (
          <Stat label={`Scenario range, ${schoolYear(scYear)}`} value={`${scLow.toLocaleString()}–${scHigh.toLocaleString()}`}
            sub={<>students if recent trends or births carry on. <span className="italic">Scenario, not a forecast.</span></>} p="REAL" />
        ) : <Stat label="Scenario range" value="—" sub="needs births for every school" p="REAL" />}
        <Stat label={`Median published tuition, ${schoolYear(tuitionYear)}`} value={money(median(tuitionL.map((t) => t.tuition!)))}
          sub={`school-published standard rate, n = ${tuitionL.length} of ${views.length}; excludes unverified listings and undated pages`} p="REAL" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" id="top-h"
          title={<>{urgent.length} school{urgent.length === 1 ? "" : "s"} with a critical or serious enrollment item</>}
          action={<Link href="/alerts" className="text-xs text-accent underline underline-offset-2">All alerts →</Link>}>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Top {top.length} to look at first</h3>
          <ol className="space-y-3">
            {top.map((v, i) => {
              const a = v.alerts[0];
              return (
                <li key={v.school.id} className="flex gap-3 text-sm">
                  <span className="w-5 shrink-0 text-right font-semibold tabular text-muted">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <SchoolLink school={v.school} /> <SeverityPill s={a.severity} />
                    </div>
                    <div>{a.title}</div>
                    <div className="text-xs text-muted">{a.detail}</div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-3 text-xs text-muted">
            Ranked by severity, then by the size of the decline since {schoolYear(BASE_YEAR)}. From state enrollment data only. Thresholds
            are starting points for discussion; see <Link href="/alerts" className="underline underline-offset-2">Alerts</Link>.
          </p>
        </Card>
        <Card title="Coming up" id="cal-h">
          <ComingUp next={nextCdeRelease(L)} />
        </Card>
      </div>

      <section aria-labelledby="sys-h" className="space-y-4">
        <h2 id="sys-h" className="text-lg font-semibold tracking-tight">Enrollment</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" title={`System enrollment, ${schoolYear(trend[0]?.year ?? 0)} to ${schoolYear(L)}`} id="trend-h">
            <TrendChart data={trend} label="System enrollment" />
          </Card>
          {county.length > 0 && (
            <Card title="Births, Santa Clara County ZIP codes (mother's residence)" id="births-h">
              <SimpleLine rows={county.map((c) => ({ x: String(c.birthYear).slice(2), y: c.births }))} format="number" label="Births by year, Santa Clara County ZIP codes" sample={false} />
              <p className="text-xs text-muted">
                {lastBirth!.births.toLocaleString()} in {lastBirth!.birthYear}, {signedPct(lastBirth!.births / peak.births - 1)} from the {peak.birthYear} peak.
                Children born in {lastBirth!.birthYear} start kindergarten in {schoolYear(lastBirth!.birthYear + 5)}. Source: CDPH via CHHS Open Data.
              </p>
            </Card>
          )}
        </div>
        <SchoolsTable rows={rows} latestLabel={`Enrollment ${schoolYear(L)}`} changeLabel={`Change since ${schoolYear(BASE_YEAR)}`} trendLabel={`${schoolYear(BASE_YEAR)} → ${schoolYear(L)}`} />
        <p className="text-xs text-muted">Sparklines run from zero to each school&apos;s own peak, so the drop shows the share of students lost.</p>
      </section>

      <section aria-labelledby="demo-h" className="space-y-4 border-t border-border pt-8">
        <div className="space-y-1">
          <h2 id="demo-h" className="text-lg font-semibold tracking-tight">Demo: the same Radar with internal data</h2>
          <p className="max-w-3xl text-sm text-muted">
            Finance, facilities and Turnaround Program data aren&apos;t public, so this part runs on {demo.length} fictional schools
            (School A–Y) with simulated data as of {dateLong(DEMO_AS_OF)}. They are not stand-ins for the schools above. <Link href="/demo" className="text-accent underline underline-offset-2">All demo schools →</Link>
          </p>
        </div>
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2" id="matrix-h" p="SAMPLE" title="Enrollment & Finance Matrix">
            <p className="mb-3 text-sm text-muted">
              Each dot is a demo school: enrollment trend since {schoolYear(BASE_YEAR)} across, financial score up. Shrinking schools with weak
              finances (bottom left, labeled) are Turnaround Program candidates: {qCount("Turnaround candidate")} there, {qCount("Watch")} to watch,{" "}
              {qCount("Growth opportunity")} growing but financially weak, {qCount("Stable")} stable.
            </p>
            <MatrixChart points={matrix} baseLabel={schoolYear(BASE_YEAR)} />
          </Card>
          <div className="flex flex-col gap-6">
            <Card title="Turnaround check-ins" id="ta-h" p="SAMPLE" className="flex-1"
              action={<Link href="/turnaround" className="text-xs text-accent underline underline-offset-2">Program</Link>}>
              <ul className="space-y-2 text-sm">
                {checkins.map((v) => (
                  <li key={v.school.id} className="flex flex-wrap items-center justify-between gap-x-2">
                    <span><SchoolLink school={v.school} /> <span className="text-xs text-muted">· {v.turnaround!.phase}</span></span>
                    <span className="text-xs"><CheckinDate date={v.turnaround!.nextCheckin} /></span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Composite health" id="comp-h" p="SAMPLE" className="flex-1">
              <dl className="grid grid-cols-3 gap-2 text-center text-sm tabular">
                {(["Stable", "Watch", "Turnaround candidate"] as const).map((t) => (
                  <div key={t} className="rounded-lg border border-border bg-surface p-2"><dt className="text-xs text-muted">{t === "Turnaround candidate" ? "Turnaround" : t}</dt><dd className="text-lg font-semibold">{tierCount(t)}</dd></div>
                ))}
              </dl>
              <p className="mt-2 text-xs text-muted">Enrollment Vitality 50%, Financial 35%, Facilities 15%. Real schools get Enrollment Vitality only.</p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
