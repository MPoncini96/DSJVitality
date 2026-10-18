import Link from "next/link";
import { MatrixChart, type MatrixPoint } from "@/components/charts";
import { RiskSchoolRef } from "@/components/Names";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { SchoolsTable, type SchoolTableRow } from "@/components/SchoolsTable";
import { TrendChart } from "@/components/TrendChart";
import { Card, Illustrative, PageHeader, SampleBanner, SeverityPill, Stat } from "@/components/ui";
import { upcoming } from "@/lib/calendar";
import { GOVERNANCE_LABEL, getTuition, median, provenanceOf, systemTrend, type SchoolScope } from "@/lib/data";
import { dateLong, dateShort, money, schoolYear, signedPct } from "@/lib/format";
import { AS_OF } from "@/lib/metrics";
import { SEVERITY_ORDER, type Alert, type Area, type Severity } from "@/lib/radar";
import { alertsProvenance, systemView } from "@/lib/system";

const AREAS: Area[] = ["Enrollment", "Finance", "Facilities", "Systems"];

function ScopeToggle({ scope, area }: { scope: SchoolScope; area?: string }) {
  const href = (s: SchoolScope) => `/?${new URLSearchParams({ ...(s === "all" ? { scope: "all" } : {}), ...(area ? { area } : {}) })}`;
  const cls = (on: boolean) =>
    `rounded-full border px-3 py-1 ${on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2"}`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Which schools to include">
      <span className="text-muted">Schools:</span>
      <Link href={href("default")} aria-current={scope === "default" ? "page" : undefined} className={cls(scope === "default")}>25 parish elementary</Link>
      <Link href={href("all")} aria-current={scope === "all" ? "page" : undefined} className={cls(scope === "all")}>All 33 listed</Link>
    </div>
  );
}

function SchoolAlerts({ id, name, alerts }: { id: string; name: string; alerts: Alert[] }) {
  const worst = alerts[0].severity;
  const shown = alerts.slice(0, 4);
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:gap-3">
      <div className="w-24 shrink-0"><SeverityPill s={worst} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <RiskSchoolRef id={id} name={name} provenance={alerts[0].provenance} href={`/schools/${id}`} />
          <span className="text-faint"> · {alerts.length} item{alerts.length > 1 ? "s" : ""}</span>
        </div>
        <ul className="mt-1 space-y-0.5">
          {shown.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span aria-hidden="true" style={{ color: `var(--${a.severity})` }}>{a.severity === "critical" ? "▲" : a.severity === "serious" ? "◆" : "●"}</span>
              <span className="sr-only">{a.severity}: </span>
              <span className="min-w-0"><span className="text-muted">{a.area}:</span> {a.title}</span>
            </li>
          ))}
          {alerts.length > shown.length && <li className="pl-5 text-xs text-muted">+{alerts.length - shown.length} more on the school page</li>}
        </ul>
      </div>
    </li>
  );
}

export default async function Radar({ searchParams }: { searchParams: Promise<{ scope?: string; area?: string }> }) {
  const sp = await searchParams;
  const scope: SchoolScope = sp.scope === "all" ? "all" : "default";
  const area = AREAS.find((a) => a === sp.area);
  const views = systemView(scope);
  const nameOf = new Map(views.map((v) => [v.school.id, v.school.name]));
  const ids = views.map((v) => v.school.id);

  const allAlerts = views.flatMap((v) => v.alerts);
  const shown = allAlerts
    .filter((a) => !area || a.area === area)
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.area.localeCompare(b.area));
  const bySchool = new Map<string, Alert[]>();
  for (const a of shown) (bySchool.get(a.schoolId) ?? bySchool.set(a.schoolId, []).get(a.schoolId)!).push(a);
  const n = (al: Alert[], s: Severity) => al.filter((a) => a.severity === s).length;
  const groups = [...bySchool.entries()].sort(
    ([, x], [, y]) => n(y, "critical") - n(x, "critical") || n(y, "serious") - n(x, "serious") || y.length - x.length
  );
  const urgent = groups.filter(([, al]) => al[0].severity !== "warning");
  const watch = groups.filter(([, al]) => al[0].severity === "warning");
  const countBy = (ar: Area, s: Severity) => allAlerts.filter((a) => a.area === ar && a.severity === s).length;
  const aProv = alertsProvenance(views);

  // System figures
  const trend = systemTrend(ids);
  const L = trend.at(-1)?.year ?? 0;
  const latest = trend.at(-1), prior = trend.at(-2);
  const yoy = latest && prior ? latest.total / prior.total - 1 : null;
  const enrollP = provenanceOf(trend.map((t) => ({ provenance: t.provenance === "REAL" ? "REAL" : "SAMPLE" })));
  const tuitionL = getTuition().filter((t) => t.year === L && ids.includes(t.schoolId) && t.tuition !== null);
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
  const areaHref = (a?: Area) => `/?${new URLSearchParams({ ...(scope === "all" ? { scope: "all" } : {}), ...(a ? { area: a } : {}) })}`;

  return (
    <div className="space-y-8">
      <PageHeader title="Radar" sub={<>What needs attention across {views.length} schools, as of {dateLong(AS_OF)}. Exceptions first; everything else is a click away.</>}>
        <ScopeToggle scope={scope} area={area} />
      </PageHeader>

      <SampleBanner />

      <section aria-label="Alerts by area" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {AREAS.map((ar) => {
          const on = area === ar;
          return (
            <Link key={ar} href={on ? areaHref() : areaHref(ar)} aria-pressed={on}
              className={`rounded-xl border bg-surface p-4 hover:bg-surface-2 ${on ? "border-accent ring-1 ring-accent" : "border-border"}`}>
              <div className="flex items-center justify-between text-xs font-medium text-muted">
                <span>{ar}</span>
                <span className="text-faint">{on ? "Filtered ✕" : "Filter"}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular">
                <span><span aria-hidden="true" style={{ color: "var(--critical)" }}>▲</span> {countBy(ar, "critical")} critical</span>
                <span><span aria-hidden="true" style={{ color: "var(--serious)" }}>◆</span> {countBy(ar, "serious")} serious</span>
                <span className="text-muted"><span aria-hidden="true" style={{ color: "var(--warning)" }}>●</span> {countBy(ar, "warning")} watch</span>
              </div>
            </Link>
          );
        })}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" id="alerts-h" p={aProv}
          title={<>Schools needing attention{area ? ` · ${area}` : ""} <span className="font-normal text-muted">({urgent.length})</span></>}>
          {urgent.length === 0 ? (
            <p className="text-sm text-muted">No school has a critical or serious item{area ? ` in ${area}` : ""}.</p>
          ) : (
            <>
              <ul>{urgent.slice(0, 8).map(([id, al]) => <SchoolAlerts key={id} id={id} name={nameOf.get(id)!} alerts={al} />)}</ul>
              {urgent.length > 8 && (
                <details className="border-t border-border pt-3">
                  <summary className="cursor-pointer text-sm text-muted">{urgent.length - 8} more schools with critical or serious items</summary>
                  <ul className="mt-1">{urgent.slice(8).map(([id, al]) => <SchoolAlerts key={id} id={id} name={nameOf.get(id)!} alerts={al} />)}</ul>
                </details>
              )}
            </>
          )}
          {watch.length > 0 && (
            <details className="mt-3 border-t border-border pt-3">
              <summary className="cursor-pointer text-sm text-muted">{watch.length} more school{watch.length > 1 ? "s" : ""} with watch items only</summary>
              <ul className="mt-1">{watch.map(([id, al]) => <SchoolAlerts key={id} id={id} name={nameOf.get(id)!} alerts={al} />)}</ul>
            </details>
          )}
          <p className="mt-4 text-xs text-muted">
            Alert rules and thresholds are listed on each school page and in <code>lib/radar.ts</code>. They are starting points, not policy.
          </p>
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
            <p className="mt-3 text-xs text-muted">Items marked SAMPLE are typical timings, to be confirmed with the Department of Catholic Schools.</p>
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

      <Card id="matrix-h" p={matrixP} title={<>Enrollment &amp; Finance Matrix {matrixP !== "REAL" && <Illustrative />}</>}>
        <p className="mb-3 max-w-3xl text-sm text-muted">
          Each dot is a school: five-year enrollment trend across, financial score up. Shrinking schools with weak finances
          (bottom left) are Turnaround Program candidates. {qCount("Turnaround candidate")} in that quadrant,{" "}
          {qCount("Watch")} to watch, {qCount("Growth opportunity")} growing but financially weak, {qCount("Stable")} stable.
        </p>
        <MatrixChart points={matrix} />
      </Card>

      <section aria-labelledby="sys-h" className="space-y-4">
        <h2 id="sys-h" className="text-lg font-semibold tracking-tight">System at a glance</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Schools" value={String(views.length)} sub="from the public school directory" p="REAL" />
          <Stat label={`Enrollment, ${schoolYear(L)}`} value={latest ? latest.total.toLocaleString() : "—"} sub={`${signedPct(yoy)} vs ${schoolYear(L - 1)}`} p={enrollP} />
          <Stat label="Median re-enrollment" value={reRates.length ? `${Math.round(median(reRates)! * 100)}%` : "—"} sub="families returning this fall" p={provenanceOf(views.map((v) => ({ provenance: v.metrics.reenrollment.provenance === "REAL" ? "REAL" : "SAMPLE" })))} />
          <Stat label={`Median tuition, ${schoolYear(L)}`} value={money(median(tuitionL.map((t) => t.tuition!)))} sub={`${tuitionL.length} schools reporting`} p={provenanceOf(tuitionL)} />
        </div>
        <Card title={`System enrollment, ${schoolYear(trend[0]?.year ?? 0)} to ${schoolYear(L)}`} p={enrollP} id="trend-h">
          <TrendChart data={trend} label="System enrollment" />
        </Card>
        <SchoolsTable rows={rows} latestLabel={`Enrollment ${schoolYear(L)}`} />
      </section>
    </div>
  );
}
