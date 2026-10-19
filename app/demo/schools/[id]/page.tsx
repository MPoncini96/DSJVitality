/**
 * A fictional demo school's page: how a school page looks once internal data
 * (finance, facilities, admissions, data feeds) is connected. Every number is simulated.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { SimpleBars, SimpleLine } from "@/components/charts";
import { AlertsCard, EnrollmentSections, FactorTable, ScoreHead, VitalityCard } from "@/components/school";
import { Tabs } from "@/components/Tabs";
import { Card, DemoNote, Stat, TierPill } from "@/components/ui";
import { DEMO_AS_OF } from "@/lib/config";
import { getSchools } from "@/lib/data";
import { dateLong, dateShort, money, moneyShort, pct, schoolYear, signedPct } from "@/lib/format";
import { COMPOSITE_WEIGHTS, TIER_CUTS } from "@/lib/health";
import { displayName } from "@/lib/names";
import { demoView } from "@/lib/system";

export function generateStaticParams() {
  return getSchools("demo").map((s) => ({ id: s.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getSchools("demo").find((x) => x.id === id);
  return { title: s ? `${s.name} (demo) · School Vitality Prototype` : "School Vitality Prototype" };
}

const S = "SAMPLE" as const;

export default async function DemoSchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = demoView().find((x) => x.school.id === id);
  if (!v) notFound();
  const { metrics: m, health: h } = v;
  const name = displayName(v.school, S);
  const e = m.enrollment, f = m.finance, fac = m.facilities;
  const comp = h.composite!, fin = h.financial!, faci = h.facilities!;
  const ta = f.ta.at(-1);

  const overview = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={`Enrollment ${schoolYear(e.latestYear)}`} value={e.latest ?? "—"} sub={`${signedPct(e.change1)} vs ${schoolYear(e.latestYear - 1)}`} p={S} />
        <Stat label={`Re-enrollment, ${m.reenrollment.year ? schoolYear(m.reenrollment.year) : ""}`} value={pct(m.reenrollment.rate)} sub="families returning" p={S} />
        <Stat label={`Tuition ${f.tuitionLatest ? schoolYear(f.tuitionLatest.year) : ""}`} value={money(f.tuitionLatest?.tuition)} sub="standard rate" p={S} />
        <Stat label="Days cash on hand" value={f.daysCash === null ? "—" : Math.round(f.daysCash)} sub="latest month-end" p={S} />
        <Stat label="Facility condition index" value={pct(fac.fci)} sub="lower is better" p={S} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Composite health" p={S} id="comp-h">
          <ScoreHead label="composite" r={comp} />
          <p className="mt-2 text-xs text-muted">
            Vitality {COMPOSITE_WEIGHTS.vitality * 100}% · Financial {COMPOSITE_WEIGHTS.financial * 100}% · Facilities {COMPOSITE_WEIGHTS.facilities * 100}%.
            Stable at {TIER_CUTS.stable}+, Watch {TIER_CUTS.watch}–{TIER_CUTS.stable - 1}, Turnaround candidate below {TIER_CUTS.watch}.
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm tabular">
            {([["Vitality", h.vitality.score], ["Financial", fin.score], ["Facilities", faci.score]] as const).map(([k, s]) => (
              <div key={k} className="rounded-lg border border-border bg-surface p-2"><div className="text-xs text-muted">{k}</div><div className="text-lg font-semibold">{s ?? "—"}</div></div>
            ))}
          </div>
          <div className="mt-4 text-xs font-semibold text-muted">Top factors pulling the score down</div>
          <ul className="mt-1 space-y-1 text-sm">
            {comp.topFactors.map((x) => (
              <li key={x.key} className="flex justify-between gap-2"><span>{x.label}</span><span className="tabular text-muted">{x.value === null ? "—" : x.format(x.value)} · −{x.drag.toFixed(0)} pts</span></li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Matrix quadrant:</span> <TierPill t={h.quadrant} />
            {v.turnaround && <span className="text-muted">· In Turnaround Program ({v.turnaround.phase})</span>}
          </div>
        </Card>
        <AlertsCard alerts={v.alerts} demo />
      </div>
      <VitalityCard v={v} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Financial score" p={S} id="fin-h"><ScoreHead label="financial" r={fin} /><div className="mt-3"><FactorTable r={fin} /></div></Card>
        <Card title="Facilities score" p={S} id="fac-h"><ScoreHead label="facilities" r={faci} /><div className="mt-3"><FactorTable r={faci} /></div></Card>
      </div>
    </div>
  );

  const enrollment = (
    <div className="space-y-6">
      <EnrollmentSections v={v} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Re-enrollment rate" p={S} id="en6">
          <SimpleLine rows={m.reenrollment.series.map((x) => ({ x: schoolYear(x.year), y: x.rate }))} format="pct" label="Re-enrollment" sample />
          <p className="text-xs text-muted">Families returning each fall, counted the spring before. No public source exists; a school system would feed this.</p>
        </Card>
        <Card title="Admissions pipeline" p={S} id="en7">
          <p className="text-sm">
            Current cycle to date: <strong className="tabular">{m.pipeline.inquiriesYtd}</strong> inquiries vs <span className="tabular">{m.pipeline.inquiriesPriorYtd}</span> at the same point last cycle ({signedPct(m.pipeline.inquiryPacing)}).
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm tabular sm:grid-cols-5">
            {(["inquiries", "tours", "applications", "accepted", "enrolled"] as const).map((k) => (
              <div key={k} className="rounded-lg border border-border bg-surface p-2"><div className="text-xs capitalize text-muted">{k}</div><div className="text-lg font-semibold">{m.pipeline.priorCycle[k]}</div></div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Last full cycle (September to August).</p>
        </Card>
      </div>
    </div>
  );

  const finance = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Operating margin FY${f.closedFy}`} value={signedPct(f.operatingMargin)} sub={`${moneyShort(f.revenue)} revenue`} p={S} />
        <Stat label={`Expense vs budget, FY${f.currentFy} YTD`} value={signedPct(f.expenseVarianceYtd)} sub={`${f.monthsClosed} months closed`} p={S} />
        <Stat label="Cost per student" value={money(f.costPerPupil)} sub={`tuition ${money(f.tuition)} · gap ${money(f.tuitionGap)}`} p={S} />
        <Stat label="Assistance / gross tuition" value={pct(f.taDependency, 1)} sub={ta ? `${ta.awards} awards, ${moneyShort(ta.totalAwarded)}` : ""} p={S} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Budget vs actual, FY${f.closedFy}`} p={S} id="fi1">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[360px] text-sm tabular">
              <thead className="text-xs text-muted"><tr><th scope="col" className="py-1 text-left font-medium">Line</th><th scope="col" className="py-1 text-right font-medium">Budget</th><th scope="col" className="py-1 text-right font-medium">Actual</th><th scope="col" className="py-1 text-right font-medium">Var.</th></tr></thead>
              <tbody>
                {f.annualByCategory.map((c) => (
                  <tr key={c.category} className="border-t border-border">
                    <td className="py-1.5 capitalize">{c.category.replace(/_/g, " ")} <span className="text-[11px] text-muted">{c.kind}</span></td>
                    <td className="py-1.5 text-right">{moneyShort(c.budget)}</td>
                    <td className="py-1.5 text-right">{moneyShort(c.actual)}</td>
                    <td className="py-1.5 text-right">{signedPct(c.actual / c.budget - 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Tuition receivable aging" p={S} id="fi2">
          <SimpleBars rows={f.receivablesAging} xKey="bucket" yKey="amount" format="money" label="Outstanding tuition" sample />
          <p className="text-xs text-muted">60+ days late: {pct(f.receivables60PlusPct, 1)} of annual billing.</p>
        </Card>
        <Card title="Tuition assistance (TADS-style)" p={S} id="fi4">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm tabular">
              <thead className="text-xs text-muted"><tr><th scope="col" className="py-1 text-left font-medium">Year</th><th scope="col" className="py-1 text-right font-medium">Applications</th><th scope="col" className="py-1 text-right font-medium">Awards</th><th scope="col" className="py-1 text-right font-medium">Awarded</th><th scope="col" className="py-1 text-right font-medium">Avg award</th></tr></thead>
              <tbody>
                {f.ta.map((r) => (
                  <tr key={r.year} className="border-t border-border">
                    <td className="py-1.5">{schoolYear(r.year)}</td><td className="py-1.5 text-right">{r.applications}</td><td className="py-1.5 text-right">{r.awards}</td>
                    <td className="py-1.5 text-right">{moneyShort(r.totalAwarded)}</td><td className="py-1.5 text-right">{money(r.totalAwarded / r.awards)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Tuition by year" p={S} id="fi3">
          <SimpleLine rows={f.tuitionSeries.map((x) => ({ x: String(x.year).slice(2), y: x.tuition }))} format="money" label="Standard tuition by school year" sample />
        </Card>
      </div>
    </div>
  );

  const facilities = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Facility condition index" value={pct(fac.fci)} sub="poor-condition share of replacement cost" p={S} />
        <Stat label="Deferred (condition 1–2)" value={moneyShort(fac.deferredCost)} sub={`of ${moneyShort(fac.totalReplacement)} tracked`} p={S} />
        <Stat label="Life-safety items open" value={fac.lifeSafetyOpen.length} sub={fac.lifeSafetyOpen.map((a) => a.asset).join(", ") || "none"} p={S} />
        <Stat label="Inspections overdue" value={fac.overdueInspections} sub={`as of ${dateShort(DEMO_AS_OF)}`} p={S} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Assets" p={S} className="lg:col-span-2" id="fa1">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm tabular">
              <thead className="text-xs text-muted"><tr>
                <th scope="col" className="py-1 pr-2 text-left font-medium">Asset</th><th scope="col" className="py-1 pr-2 text-left font-medium">Condition</th>
                <th scope="col" className="py-1 pr-2 text-left font-medium">Last inspected</th><th scope="col" className="py-1 pr-2 text-right font-medium">Replacement</th>
                <th scope="col" className="py-1 pr-2 text-left font-medium">Priority</th><th scope="col" className="py-1 text-right font-medium">Plan year</th>
              </tr></thead>
              <tbody>
                {fac.assets.map((a) => (
                  <tr key={a.assetId} className="border-t border-border">
                    <td className="py-1.5 pr-2">{a.asset}<span className="block text-[11px] text-muted">{a.category}</span></td>
                    <td className="py-1.5 pr-2"><span aria-hidden="true">{"■".repeat(a.condition)}<span className="text-border">{"■".repeat(5 - a.condition)}</span></span> <span className="text-xs text-muted">{a.condition}/5</span></td>
                    <td className="py-1.5 pr-2">{a.lastInspection}{a.overdue && <span className="ml-1 text-xs font-semibold" style={{ color: "var(--critical)" }}>overdue</span>}</td>
                    <td className="py-1.5 pr-2 text-right">{moneyShort(a.cost)}</td>
                    <td className="py-1.5 pr-2">{a.priority}</td>
                    <td className="py-1.5 text-right">{a.planYear}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Capital plan by year" p={S} id="fa2">
          <SimpleBars rows={fac.capitalByYear.map((x) => ({ year: String(x.year), cost: x.cost }))} xKey="year" yKey="cost" format="money" label="Planned replacement cost" sample />
        </Card>
      </div>
    </div>
  );

  const quality = (
    <Card title="Data feeds for this school" p={S} id="dq1">
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm tabular">
          <thead className="text-xs text-muted"><tr>
            <th scope="col" className="py-1 pr-2 text-left font-medium">System</th><th scope="col" className="py-1 pr-2 text-left font-medium">Last refresh</th>
            <th scope="col" className="py-1 pr-2 text-right font-medium">Rows</th><th scope="col" className="py-1 pr-2 text-right font-medium">Complete</th>
            <th scope="col" className="py-1 text-right font-medium">Issues</th>
          </tr></thead>
          <tbody>
            {m.systems.feeds.map((x) => (
              <tr key={x.feed} className="border-t border-border">
                <td className="py-1.5 pr-2">{x.feed}</td>
                <td className="py-1.5 pr-2">{x.lastRefresh} <span className={`text-xs ${x.daysOld > 30 ? "font-semibold" : "text-muted"}`} style={x.daysOld > 30 ? { color: "var(--critical)" } : undefined}>({x.daysOld} days)</span></td>
                <td className="py-1.5 pr-2 text-right">{x.rowCount.toLocaleString()}</td>
                <td className="py-1.5 pr-2 text-right">{x.completenessPct.toFixed(1)}%</td>
                <td className="py-1.5 text-right">{x.issues}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted">Feeds older than 30 days or under 80% complete raise a Systems alert. Feed ages are as of {dateLong(DEMO_AS_OF)}.</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted"><Link href="/demo" className="underline underline-offset-2">Demo schools</Link> / {name}</nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{name} <span className="text-base font-normal text-muted">(fictional)</span></h1>
        <p className="text-sm text-muted">Demo school · simulated internal data as of {dateLong(DEMO_AS_OF)}</p>
      </div>
      <DemoNote />
      <Tabs tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "enrollment", label: "Enrollment", content: enrollment },
        { id: "finance", label: "Finance", content: finance },
        { id: "facilities", label: "Facilities", content: facilities },
        { id: "data", label: "Data quality", content: quality },
      ]} />
    </div>
  );
}
