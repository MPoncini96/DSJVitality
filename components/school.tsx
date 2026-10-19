/**
 * Building blocks for the school pages. The real page (/schools/[id]) and the demo page
 * (/demo/schools/[id]) use the same blocks; each block takes the provenance of what it
 * shows, so a real school's page only ever renders REAL blocks.
 */
import { GradeBandChart, ScenarioChart, SimpleLine } from "@/components/charts";
import { TrendChart } from "@/components/TrendChart";
import { Card, SeverityPill, TierPill } from "@/components/ui";
import { latestEnrollmentYear } from "@/lib/data";
import { money, pct, schoolYear, signedPct } from "@/lib/format";
import type { ScoreResult } from "@/lib/health";
import { RULES, type Alert } from "@/lib/radar";
import type { SchoolView } from "@/lib/system";

export function FactorTable({ r }: { r: ScoreResult }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[440px] text-sm tabular">
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="py-1 pr-3 text-left font-medium">Factor</th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">Value</th>
            <th scope="col" className="py-1 pr-3 text-left font-medium">Sub-score</th>
            <th scope="col" className="py-1 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody>
          {r.factors.filter((f) => f.weight > 0).map((f) => (
            <tr key={f.key} className="border-t border-border">
              <td className="py-2 pr-3" title={f.explain}>
                {f.label}
                <div className="text-[11px] text-muted">concern {f.format(f.concern)} → healthy {f.format(f.healthy)}</div>
              </td>
              <td className="py-2 pr-3 text-right">{f.value === null ? "—" : f.format(f.value)}</td>
              <td className="py-2 pr-3">
                {f.sub === null ? <span className="text-xs text-muted">skipped</span> : (
                  <span className="flex items-center gap-2">
                    <span className="relative inline-block h-1.5 w-20 rounded-full bg-surface-2" aria-hidden="true">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${f.sub}%` }} />
                    </span>
                    {f.sub}
                  </span>
                )}
              </td>
              <td className="py-2 text-right">{f.sub === null ? "—" : pct(f.effectiveWeight)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ScoreHead({ label, r }: { label: string; r: { score: number | null; tier: Parameters<typeof TierPill>[0]["t"] } }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="text-3xl font-semibold tabular">{r.score ?? "—"}</span>
      <span className="text-sm text-muted">/ 100 {label}</span>
      <TierPill t={r.tier} />
    </div>
  );
}

export function VitalityCard({ v }: { v: SchoolView }) {
  const h = v.health;
  return (
    <Card title="Enrollment Vitality" p={h.vitality.provenance} id="vit-h">
      <ScoreHead label={v.school.demo ? "" : "from public data"} r={h.vitality} />
      <p className="mt-2 text-xs text-muted">
        {v.school.demo
          ? "Same formula as for the real schools, run on this fictional school's simulated enrollment and births."
          : "Built only from public data: state enrollment by grade (CDE) and births by ZIP (CDPH). Stable at 70+, Watch 50–69, Turnaround candidate below 50."}
      </p>
      <div className="mt-3"><FactorTable r={h.vitality} /></div>
    </Card>
  );
}

export function AlertsCard({ alerts, demo }: { alerts: Alert[]; demo: boolean }) {
  const rules = RULES.filter((r) => demo || r.area === "Enrollment");
  return (
    <Card title={<>Alerts <span className="font-normal text-muted">({alerts.length})</span></>} p={demo ? "SAMPLE" : "REAL"} id="al-h">
      {alerts.length === 0 ? <p className="text-sm text-muted">No alerts.</p> : (
        <ul className="space-y-2">
          {alerts.map((a, i) => (
            <li key={i} className="flex flex-wrap items-start gap-3 text-sm">
              <SeverityPill s={a.severity} /><span className="text-muted">{a.area}</span>
              <span className="min-w-0 flex-1">{a.title}{a.detail && <span className="block text-xs text-muted">{a.detail}</span>}</span>
            </li>
          ))}
        </ul>
      )}
      <details className="mt-4 text-xs text-muted">
        <summary className="cursor-pointer">Alert rules</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{rules.map((r) => <li key={r.description}><span className="font-medium">{r.area}:</span> {r.description}</li>)}</ul>
        {!demo && <p className="mt-2">Finance, facilities and systems alerts need internal data, so they run only in the demo.</p>}
      </details>
    </Card>
  );
}

/** Enrollment sections that every school has (real: CDE + CDPH; demo: simulated). */
export function EnrollmentSections({ v }: { v: SchoolView }) {
  const m = v.metrics, e = m.enrollment;
  const P = e.provenance;
  const L = e.latestYear;
  const years = [...new Set(e.byGrade.map((g) => g.year))].sort();
  const bands = { "K-2": ["K", "1", "2"], "3-5": ["3", "4", "5"], "6-8": ["6", "7", "8"] };
  const bandRows = years.map((y) => {
    const row: { year: number; [k: string]: number } = { year: y };
    for (const [b, gs] of Object.entries(bands)) row[b] = e.byGrade.filter((g) => g.year === y && gs.includes(g.grade)).reduce((a, g) => a + g.count, 0);
    return row;
  });
  const gradesL = e.byGrade.filter((g) => g.year === L);
  const sample = P !== "REAL";
  const sc = m.scenario;
  const lastSc = sc.years.at(-1);
  const kLast = m.market.kShare.at(-1);
  return (
    <>
      <Card title="Total enrollment" p={P} id="en1">
        <TrendChart data={e.series.map((s) => ({ ...s, provenance: P }))} label="Total enrollment" />
        <p className="mt-1 text-xs text-muted">
          {sample ? "Simulated." : <>Source: <a className="text-accent underline underline-offset-2" href="https://www.cde.ca.gov/ds/si/ps/">California Department of Education, Private School Affidavit</a>. Self-reported by the school each October; totals are the sum of grades K–8.</>}
          {" "}Since {schoolYear(e.baseYear)}: {signedPct(e.changeSinceBase)} ({signedPct(e.cagr)} a year).
        </p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Enrollment by grade band" p={P} id="en2">
          <GradeBandChart rows={bandRows} sample={sample} />
        </Card>
        <Card title={`By grade, ${schoolYear(L)}`} p={P} id="en3">
          <div className="flex h-56 items-end gap-1.5 sm:gap-2" role="img" aria-label={`Students by grade: ${gradesL.map((g) => `${g.grade} ${g.count}`).join(", ")}`}>
            {gradesL.map((g) => {
              const max = Math.max(...gradesL.map((x) => x.count));
              return (
                <div key={g.grade} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] tabular text-muted">{g.count}</span>
                  <div className={`w-full rounded-t ${g.count < 15 ? "bg-[var(--critical)]" : "bg-accent"}`} style={{ height: `${(g.count / max) * 170}px` }} />
                  <span className="text-xs text-muted">{g.grade}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Red bars: under 15 students, below a workable single-classroom size.</p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={sample ? "Births near the school" : "Births in ZIP codes within 4 miles (mother's residence)"} p={m.market.provenance} id="en4">
          {m.market.births.length ? (
            <>
              <SimpleLine rows={m.market.births.map((x) => ({ x: String(x.year).slice(2), y: x.births }))} format="number" label="Births in the school's catchment by year" sample={sample} />
              <p className="text-xs text-muted">
                {signedPct(m.market.births5Change)} from {(m.market.latestBirthYear ?? 0) - 5} to {m.market.latestBirthYear}. Births in a year set the
                kindergarten pool about five years later.
                {!sample && <> ZIPs: {m.market.catchmentZips.join(", ")}. Source: CDPH via CHHS Open Data.</>}
              </p>
            </>
          ) : <p className="text-sm text-muted">No births data for this school.</p>}
        </Card>
        <Card title="Kindergarten share of local births" p={m.market.provenance} id="en5">
          {kLast ? (
            <>
              <SimpleLine rows={m.market.kShare.map((x) => ({ x: String(x.year).slice(2), y: x.share }))} format="pct2" label="Kindergartners divided by births five years earlier" sample={sample} />
              <p className="text-xs text-muted">
                {kLast.k} kindergartners in {schoolYear(kLast.year)} from {kLast.births.toLocaleString()} births in {kLast.year - 5}.
                Trend {signedPct(m.market.shareTrend)} a year. Compare over time, not across schools: catchments overlap and differ in size.
              </p>
            </>
          ) : <p className="text-sm text-muted">Needs kindergarten and births data.</p>}
        </Card>
      </div>
      {lastSc && (
        <Card title={`Enrollment scenarios to ${schoolYear(lastSc.year)}`} p={sample ? "SAMPLE" : "PROJECTED"} id="en-proj">
          <p className="mb-2 text-sm">
            <strong>Scenario, not a forecast.</strong> Two simple what-ifs give a range of{" "}
            <strong className="tabular">{lastSc.low.toLocaleString()}–{lastSc.high.toLocaleString()}</strong> students in {schoolYear(lastSc.year)},
            vs. {e.latest} in {schoolYear(L)}.
          </p>
          <ScenarioChart actual={e.series} range={sc.years} label={`Actual enrollment through ${schoolYear(L)}, then a scenario range through ${schoolYear(lastSc.year)}`} />
          <div className="relative mt-3 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm tabular">
              <thead className="text-xs text-muted"><tr>
                <th scope="col" className="py-1 text-left font-medium">School year</th>
                <th scope="col" className="py-1 text-right font-medium">Trend scenario</th>
                <th scope="col" className="py-1 text-right font-medium">Births scenario</th>
                <th scope="col" className="py-1 text-right font-medium">Range</th>
              </tr></thead>
              <tbody>
                {sc.years.map((y) => (
                  <tr key={y.year} className="border-t border-border">
                    <td className="py-1.5">{schoolYear(y.year)}</td><td className="py-1.5 text-right">{y.trend}</td><td className="py-1.5 text-right">{y.births}</td>
                    <td className="py-1.5 text-right">{y.low}–{y.high}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted">
            {sc.method} Neither scenario knows about a new principal, a marketing push or a neighboring school closing; they show what the
            recent trend and the local births curve imply if nothing changes.
          </p>
        </Card>
      )}
    </>
  );
}

/** Published tuition for a real school: REAL, UNVERIFIED (third-party) or not published. */
export function TuitionCard({ f, review }: { f: SchoolView["metrics"]["finance"]; review?: { notes: string; sourceUrl: string } }) {
  const t = f.tuitionLatest, u = f.tuitionUnverified;
  const prior = t ? f.tuitionSeries.find((x) => x.year === t.year - 1) : undefined;
  const link = (href: string, text: string) => <a href={href} className="text-accent underline underline-offset-2">{text}</a>;
  const stripUpFrom = (n: string) => n.replace(/Up from \$[\d,]+(?: in \d{4}-\d{2})?(?: \([^)]*\))?[.;]?\s*/, "").trim();
  return (
    <Card title="Published tuition" p={t ? "REAL" : u ? "UNVERIFIED" : "REAL"} id="fi3">
      {t ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-semibold tabular">{money(t.tuition)}</span>
            <span className="text-muted">standard rate, {schoolYear(t.year)}{!t.yearStated && " (year not stated on the page)"}</span>
          </div>
          {t.parishRate !== null && t.parishRate !== t.tuition && (
            <div>Parishioner rate <strong className="tabular">{money(t.parishRate)}</strong> <span className="text-muted">({money(t.tuition - t.parishRate)} less)</span></div>
          )}
          {prior && <div>Up from <strong className="tabular">{money(prior.tuition)}</strong> in {schoolYear(prior.year)} <span className="text-muted">({signedPct(t.tuition / prior.tuition - 1)})</span></div>}
          {stripUpFrom(t.notes) && <p className="text-xs text-muted">{stripUpFrom(t.notes)}</p>}
          {t.sourceUrl && <p className="text-xs">{link(t.sourceUrl, "School's tuition page")}</p>}
        </div>
      ) : u ? (
        <div className="space-y-2 text-sm">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="text-3xl font-semibold tabular text-muted">{money(u.tuition)}</span>
            <span className="text-muted">third-party listing{u.schoolYear ? `, ${u.schoolYear}` : ", year unknown"}</span>
          </div>
          <p className="text-xs text-muted">Not confirmed on the school&apos;s own site, so it is shown for reference only and left out of every median and score. {u.notes}</p>
          {u.sourceUrl && <p className="text-xs">{link(u.sourceUrl, "Listing")}</p>}
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <p><strong>Not published.</strong> No rate could be confirmed on the school&apos;s site, and none is estimated here.</p>
          {review?.notes && <p className="text-xs text-muted">{review.notes}</p>}
          {review?.sourceUrl && <p className="text-xs">{link(review.sourceUrl, "Page checked")}</p>}
        </div>
      )}
    </Card>
  );
}

/** "Latest state data: 2025-26 school year (CDE, published Sept 2026)" — the year comes from the data. */
export function stateDataLabel(published: string) {
  return `Latest state data: ${schoolYear(latestEnrollmentYear())} school year (CDE, published ${published})`;
}
