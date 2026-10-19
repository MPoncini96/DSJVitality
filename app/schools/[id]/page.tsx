import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeBandChart, ProjectionChart, SimpleBars, SimpleLine } from "@/components/charts";
import { SchoolName } from "@/components/Names";
import { ProvenanceBadge } from "@/components/ProvenanceBadge";
import { Tabs } from "@/components/Tabs";
import { TrendChart } from "@/components/TrendChart";
import { Card, Illustrative, SampleBanner, SeverityPill, Stat, TierPill } from "@/components/ui";
import { GOVERNANCE_LABEL, getSchool, getSchools, getStaffing, getTuitionReview, provenanceOf, type MixedProvenance } from "@/lib/data";
import { dateShort, money, moneyShort, pct, schoolYear, signedPct } from "@/lib/format";
import { COMPOSITE_WEIGHTS, TIER_CUTS, type ScoreResult } from "@/lib/health";
import { AS_OF } from "@/lib/metrics";
import { RULES } from "@/lib/radar";
import { systemView, type SchoolView } from "@/lib/system";

export function generateStaticParams() {
  return getSchools("all").map((s) => ({ id: s.id }));
}

const asP = (p: MixedProvenance) => ({ provenance: p === "REAL" ? ("REAL" as const) : ("SAMPLE" as const) });

function FactorTable({ r }: { r: ScoreResult }) {
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm tabular">
        <thead className="text-xs text-muted">
          <tr>
            <th scope="col" className="py-1 pr-3 text-left font-medium">Factor</th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">Value</th>
            <th scope="col" className="py-1 pr-3 text-left font-medium">Sub-score</th>
            <th scope="col" className="py-1 pr-3 text-right font-medium">Weight</th>
            <th scope="col" className="py-1 text-left font-medium"><span className="sr-only">Data</span></th>
          </tr>
        </thead>
        <tbody>
          {r.factors.map((f) => (
            <tr key={f.key} className="border-t border-border">
              <td className="py-2 pr-3" title={f.explain}>
                {f.label}
                <div className="text-[11px] text-faint">concern {f.format(f.concern)} → healthy {f.format(f.healthy)}</div>
              </td>
              <td className="py-2 pr-3 text-right">{f.value === null ? "—" : f.format(f.value)}</td>
              <td className="py-2 pr-3">
                {f.sub === null ? <span className="text-xs text-faint">skipped</span> : (
                  <span className="flex items-center gap-2">
                    <span className="relative inline-block h-1.5 w-24 rounded-full bg-surface-2" aria-hidden="true">
                      <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${f.sub}%` }} />
                    </span>
                    {f.sub}
                  </span>
                )}
              </td>
              <td className="py-2 pr-3 text-right">{f.sub === null ? "—" : pct(f.effectiveWeight)}</td>
              <td className="py-2"><ProvenanceBadge p={f.provenance} compact /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ScoreHead({ label, r, illustrative }: { label: string; r: { score: number | null; tier: Parameters<typeof TierPill>[0]["t"] }; illustrative?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline gap-3">
      <span className="text-3xl font-semibold tabular">{r.score ?? "—"}</span>
      <span className="text-sm text-muted">/ 100 {label}</span>
      <TierPill t={r.tier} />
      {illustrative && <Illustrative />}
    </div>
  );
}

function TuitionValue({ f }: { f: SchoolView["metrics"]["finance"] }) {
  if (f.tuitionLatest) return <>{money(f.tuitionLatest.tuition)}</>;
  if (f.tuitionUnverified) return <span className="text-muted">{money(f.tuitionUnverified.tuition)}</span>;
  return <span className="text-muted">Not published</span>;
}

function tuitionBadge(f: SchoolView["metrics"]["finance"]) {
  return f.tuitionLatest ? f.tuitionLatest.provenance : f.tuitionUnverified ? ("UNVERIFIED" as const) : ("REAL" as const);
}

function TuitionCard({ f, review }: { f: SchoolView["metrics"]["finance"]; review?: { outcome: string; notes: string; sourceUrl: string } }) {
  const t = f.tuitionLatest, u = f.tuitionUnverified;
  const prior = t ? f.tuitionSeries.find((x) => x.year === t.year - 1) : undefined;
  const link = (href: string, text: string) => <a href={href} className="text-accent underline underline-offset-2">{text}</a>;
  return (
    <Card title="Published tuition" p={tuitionBadge(f)} id="fi3">
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
          {t.notes.replace(/Up from \$[\d,]+(?: in \d{4}-\d{2})?(?: \([^)]*\))?[.;]?\s*/, "").trim() && <p className="text-xs text-muted">{t.notes.replace(/Up from \$[\d,]+(?: in \d{4}-\d{2})?(?: \([^)]*\))?[.;]?\s*/, "").trim()}</p>}
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

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const school = getSchool(id);
  if (!school) notFound();
  const v = systemView("all").find((x) => x.school.id === id)!;
  const { metrics: m, health: h } = v;
  const e = m.enrollment, f = m.finance, fac = m.facilities;
  const L = e.latestYear;
  const isHS = e.entryGrade === "9";

  const bands = isHS ? { "9-10": ["9", "10"], "11-12": ["11", "12"] } : { "K-2": ["K", "1", "2"], "3-5": ["3", "4", "5"], "6-8": ["6", "7", "8"] };
  const years = [...new Set(e.byGrade.map((g) => g.year))].sort();
  const bandRows = years.map((y) => {
    const row: { year: number; [k: string]: number } = { year: y };
    for (const [b, gs] of Object.entries(bands)) row[b] = e.byGrade.filter((g) => g.year === y && gs.includes(g.grade)).reduce((a, g) => a + g.count, 0);
    return row;
  });
  const gradesL = e.byGrade.filter((g) => g.year === L);
  const tuitionReview = getTuitionReview().find((r) => r.schoolId === id);
  const staff = getStaffing().filter((x) => x.schoolId === id).sort((a, b) => a.year - b.year);
  const staffL = staff.at(-1);
  const alertsP = provenanceOf(v.alerts.map((a) => asP(a.provenance)));

  const overview = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label={`Enrollment ${schoolYear(L)}`} value={e.latest ?? "—"} sub={`${signedPct(e.change1)} vs last fall`} p={e.provenance} />
        <Stat label="Re-enrollment" value={pct(m.reenrollment.rate)} sub={m.reenrollment.year ? `for ${schoolYear(m.reenrollment.year)}` : ""} p={m.reenrollment.provenance} />
        <Stat label={`Tuition${f.tuitionLatest ? ` ${schoolYear(f.tuitionLatest.year)}` : ""}`} value={<TuitionValue f={f} />} sub={f.tuitionLatest ? "school's published rate" : f.tuitionUnverified ? "third-party listing" : "school does not publish it"} p={tuitionBadge(f)} />
        <Stat label="Days cash on hand" value={f.daysCash === null ? "—" : Math.round(f.daysCash)} sub="latest month-end" p={f.provenance} />
        <Stat label="Facility condition index" value={pct(fac.fci)} sub="lower is better" p={fac.provenance} />
      </div>

      <>
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Enrollment Vitality" p={h.vitality.provenance} id="vit-h">
            <ScoreHead label="from public data" r={h.vitality} />
            <p className="mt-2 text-xs text-muted">Built only from REAL public inputs: state enrollment by grade (CDE) and births by ZIP (CDPH). Any input that is not REAL is skipped rather than used.</p>
            <div className="mt-3"><FactorTable r={h.vitality} /></div>
          </Card>
          <Card title="Composite health" p={h.composite.provenance} id="comp-h">
            <ScoreHead label="composite" r={h.composite} illustrative={h.composite.provenance !== "REAL"} />
            <p className="mt-2 text-xs text-muted">
              Vitality {COMPOSITE_WEIGHTS.vitality * 100}% · Financial {COMPOSITE_WEIGHTS.financial * 100}% · Facilities {COMPOSITE_WEIGHTS.facilities * 100}%.
              Stable at {TIER_CUTS.stable}+, Watch {TIER_CUTS.watch}–{TIER_CUTS.stable - 1}, Turnaround candidate below {TIER_CUTS.watch}.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm tabular">
              {[["Vitality", h.vitality.score], ["Financial", h.financial.score], ["Facilities", h.facilities.score]].map(([k, s]) => (
                <div key={k as string} className="rounded-lg border border-border p-2"><div className="text-xs text-muted">{k}</div><div className="text-lg font-semibold">{s ?? "—"}</div></div>
              ))}
            </div>
            <div className="mt-4 text-xs font-semibold text-muted">Top factors pulling the score down</div>
            <ul className="mt-1 space-y-1 text-sm">
              {h.composite.topFactors.map((x) => (
                <li key={x.key} className="flex justify-between gap-2"><span>{x.label}</span><span className="tabular text-muted">{x.value === null ? "—" : x.format(x.value)} · −{x.drag.toFixed(0)} pts</span></li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Matrix quadrant:</span> <TierPill t={h.quadrant} />
              {v.turnaround && <span className="text-muted">· In Turnaround Program ({v.turnaround.phase})</span>}
            </div>
          </Card>
        </div>
        <Card title={<>Alerts <span className="font-normal text-muted">({v.alerts.length})</span></>} p={alertsP} className="mt-6" id="al-h">
          {v.alerts.length === 0 ? <p className="text-sm text-muted">No alerts.</p> : (
            <ul className="space-y-2">
              {v.alerts.map((a, i) => (
                <li key={i} className="flex flex-wrap items-start gap-3 text-sm">
                  <SeverityPill s={a.severity} /><span className="text-muted">{a.area}</span>
                  <span className="min-w-0 flex-1">{a.title}{a.detail && <span className="block text-xs text-muted">{a.detail}</span>}</span>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-4 text-xs text-muted">
            <summary className="cursor-pointer">All alert rules</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5">{RULES.map((r) => <li key={r.description}><span className="font-medium">{r.area}:</span> {r.description}</li>)}</ul>
          </details>
        </Card>
      </>

      <Card title="About this school" p="REAL" id="loc-h">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Type</dt><dd>{GOVERNANCE_LABEL[school.governance]} <span className="text-xs text-faint">({school.governanceBasis})</span></dd></div>
          <div><dt className="text-xs text-muted">Grades in data</dt><dd>{gradesL.length ? `${gradesL[0].grade}–${gradesL.at(-1)!.grade}` : "—"}</dd></div>
            <div><dt className="text-xs text-muted">Address</dt><dd>{school.address}, {school.city} {school.zip}</dd></div>
            <div><dt className="text-xs text-muted">Phone</dt><dd>{school.phone}</dd></div>
            <div><dt className="text-xs text-muted">Website</dt><dd><a href={school.website} className="text-accent underline underline-offset-2">{school.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd></div>
          <div><dt className="text-xs text-muted">Source</dt><dd><a href={school.sourceUrl} className="text-accent underline underline-offset-2">School directory</a>, retrieved {school.retrieved}</dd></div>
        </dl>
      </Card>
    </div>
  );

  const enrollment = (
    <div className="space-y-6">
      <Card title="Total enrollment" p={e.provenance} id="en1">
        <TrendChart data={e.series.map((s) => ({ ...s, provenance: e.provenance }))} label="Total enrollment" />
        {e.provenance === "REAL" && (
          <p className="mt-1 text-xs text-muted">
            Source: <a className="text-accent underline underline-offset-2" href="https://www.cde.ca.gov/ds/si/ps/">California Department of Education, Private School Affidavit</a>.
            Self-reported by the school each October; totals are the sum of grades K–8.
          </p>
        )}
      </Card>
      {staffL && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label={`Full-time teachers, ${schoolYear(staffL.year)}`} value={staffL.ftTeachers} sub={`${staffL.ptTeachers} part-time`} p={staffL.provenance} />
          <Stat label="Students per full-time teacher" value={e.latest && staffL.ftTeachers ? (e.latest / staffL.ftTeachers).toFixed(1) : "—"} sub={staff.length > 1 ? `${(staff[0].ftTeachers ? (e.series.find((x) => x.year === staff[0].year)?.total ?? 0) / staff[0].ftTeachers : 0).toFixed(1)} in ${schoolYear(staff[0].year)}` : ""} p={staffL.provenance} />
          <Stat label="Administrators" value={staffL.admins} sub="reported to CDE" p={staffL.provenance} />
          <Stat label="Other staff" value={staffL.otherStaff} sub="reported to CDE" p={staffL.provenance} />
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Enrollment by grade band" p={e.provenance} id="en2">
          <GradeBandChart rows={bandRows} sample={e.provenance !== "REAL"} />
        </Card>
        <Card title={`By grade, ${schoolYear(L)}`} p={e.provenance} id="en3">
          <div className="flex h-56 items-end gap-2" role="img" aria-label={`Students by grade: ${gradesL.map((g) => `${g.grade} ${g.count}`).join(", ")}`}>
            {gradesL.map((g) => {
              const max = Math.max(...gradesL.map((x) => x.count));
              return (
                <div key={g.grade} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] tabular text-muted">{g.count}</span>
                  <div className={`w-full rounded-t ${g.count < 15 ? "bg-[var(--critical)]" : e.provenance !== "REAL" ? "bg-[var(--sample-mark)]" : "bg-accent"}`} style={{ height: `${(g.count / max) * 170}px` }} />
                  <span className="text-xs text-muted">{g.grade}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Red bars: under 15 students, below a workable single-classroom size.</p>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Births within 4 miles" p={m.market.provenance} id="en4">
          {m.market.births.length ? (
            <>
              <SimpleLine rows={m.market.births.map((x) => ({ x: String(x.year).slice(2), y: x.births }))} format="number" label="Births in the school's catchment by year" sample={m.market.provenance !== "REAL"} />
              <p className="text-xs text-muted">
                {signedPct(m.market.births5Change)} from {(m.market.latestBirthYear ?? 0) - 5} to {m.market.latestBirthYear}. Births in a year set the
                kindergarten pool about five years later. ZIPs: {m.market.catchmentZips.join(", ")}.
              </p>
            </>
          ) : <p className="text-sm text-muted">No births data for this school.</p>}
        </Card>
        <Card title="Kindergarten share of local births" p={m.market.provenance} id="en5">
          {m.market.kShare.length ? (
            <>
              <SimpleLine rows={m.market.kShare.map((x) => ({ x: String(x.year).slice(2), y: x.share }))} format="pct2" label="Kindergartners divided by births five years earlier" sample={m.market.provenance !== "REAL"} />
              <p className="text-xs text-muted">
                {m.market.kShare.at(-1)!.k} kindergartners in {schoolYear(m.market.kShare.at(-1)!.year)} from {m.market.kShare.at(-1)!.births.toLocaleString()} births
                in {m.market.kShare.at(-1)!.year - 5}. Trend {signedPct(m.market.shareTrend)} a year. Compare over time, not across schools:
                catchments overlap and differ in size.
              </p>
            </>
          ) : <p className="text-sm text-muted">Needs REAL kindergarten and births data.</p>}
        </Card>
        <Card title="Re-enrollment rate" p={m.reenrollment.provenance} id="en6">
          <SimpleLine rows={m.reenrollment.series.map((x) => ({ x: String(x.year).slice(2), y: x.rate }))} format="pct" label="Re-enrollment" sample={m.reenrollment.provenance !== "REAL"} />
          <p className="text-xs text-muted">Families returning, counted in spring. No public source; this stays simulated until a school system feeds it.</p>
        </Card>
      </div>
      {m.projection.years.length > 0 && (
        <Card title={`Projected enrollment to ${schoolYear(m.projection.years.at(-1)!.year)}`} p="PROJECTED" id="en-proj">
          <ProjectionChart actual={e.series} projected={m.projection.years} label={`Actual enrollment through ${schoolYear(L)}, then projected through ${schoolYear(m.projection.years.at(-1)!.year)}`} />
          <div className="mt-3 relative overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm tabular">
              <thead className="text-xs text-muted"><tr>
                <th scope="col" className="py-1 text-left font-medium">School year</th>
                <th scope="col" className="py-1 text-right font-medium">Kindergarten</th>
                <th scope="col" className="py-1 text-right font-medium">Total K–8</th>
                <th scope="col" className="py-1 text-right font-medium">vs {schoolYear(L)}</th>
              </tr></thead>
              <tbody>
                {m.projection.years.map((y) => (
                  <tr key={y.year} className="border-t border-border">
                    <td className="py-1.5">{schoolYear(y.year)}</td><td className="py-1.5 text-right">{y.k}</td><td className="py-1.5 text-right">{y.total}</td>
                    <td className="py-1.5 text-right">{e.latest ? signedPct(y.total / e.latest - 1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {m.projection.lowConfidence.length > 0 && (
            <p className="mt-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted">
              <strong className="text-text">Low confidence:</strong> {m.projection.lowConfidence.join("; ")}.
            </p>
          )}
          <p className="mt-2 text-xs text-muted">
            {m.projection.method} Assumes this school keeps its recent share and continuation rates; it is a planning baseline, not a prediction
            of what the school will do. Inputs: <ProvenanceBadge p={m.projection.inputs} compact /> state enrollment and births.
          </p>
        </Card>
      )}
      <Card title="Admissions pipeline" p={m.pipeline.provenance} id="en7">
        <p className="text-sm">
          Current cycle to date: <strong className="tabular">{m.pipeline.inquiriesYtd}</strong> inquiries vs <span className="tabular">{m.pipeline.inquiriesPriorYtd}</span> at the same point last cycle ({signedPct(m.pipeline.inquiryPacing)}).
        </p>
        <div className="mt-3 grid grid-cols-5 gap-2 text-center text-sm tabular">
          {(["inquiries", "tours", "applications", "accepted", "enrolled"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-border p-2"><div className="text-xs capitalize text-muted">{k}</div><div className="text-lg font-semibold">{m.pipeline.priorCycle[k]}</div></div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">Last full cycle (September to August). A centralized prospective-family database would feed this directly.</p>
      </Card>
    </div>
  );

  const ta = f.ta.at(-1);
  const finance = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Operating margin FY${f.closedFy}`} value={signedPct(f.operatingMargin)} sub={`${moneyShort(f.revenue)} revenue`} p={f.provenance} />
        <Stat label={`Expense vs budget, FY${f.currentFy} YTD`} value={signedPct(f.expenseVarianceYtd)} sub={`${f.monthsClosed} months closed`} p={f.provenance} />
        <Stat label="Cost per student" value={money(f.costPerPupil)} sub={`tuition ${money(f.tuition)} · gap ${money(f.tuitionGap)}`} p={f.provenance} />
        <Stat label="Assistance / gross tuition" value={pct(f.taDependency, 1)} sub={ta ? `${ta.awards} awards, ${moneyShort(ta.totalAwarded)}` : ""} p={f.provenance} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Budget vs actual, FY${f.closedFy}`} p={f.provenance} id="fi1">
          <table className="w-full text-sm tabular">
            <thead className="text-xs text-muted"><tr><th scope="col" className="py-1 text-left font-medium">Line</th><th scope="col" className="py-1 text-right font-medium">Budget</th><th scope="col" className="py-1 text-right font-medium">Actual</th><th scope="col" className="py-1 text-right font-medium">Var.</th></tr></thead>
            <tbody>
              {f.annualByCategory.map((c) => (
                <tr key={c.category} className="border-t border-border">
                  <td className="py-1.5 capitalize">{c.category.replace(/_/g, " ")} <span className="text-[11px] text-faint">{c.kind}</span></td>
                  <td className="py-1.5 text-right">{moneyShort(c.budget)}</td>
                  <td className="py-1.5 text-right">{moneyShort(c.actual)}</td>
                  <td className="py-1.5 text-right">{signedPct(c.actual / c.budget - 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card title="Tuition receivable aging" p={f.provenance} id="fi2">
          <SimpleBars rows={f.receivablesAging} xKey="bucket" yKey="amount" format="money" label="Outstanding tuition" sample={f.provenance !== "REAL"} />
          <p className="text-xs text-muted">60+ days late: {pct(f.receivables60PlusPct, 1)} of annual billing. As of {dateShort("2026-09-30")}.</p>
        </Card>
        <TuitionCard f={f} review={tuitionReview} />
        <Card title={<>Tuition assistance <span className="font-normal text-muted">(TADS-style)</span></>} p={f.provenance} id="fi4">
          <table className="w-full text-sm tabular">
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
        </Card>
      </div>
    </div>
  );

  const facilities = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Facility condition index" value={pct(fac.fci)} sub="poor-condition share of replacement cost" p={fac.provenance} />
        <Stat label="Deferred (condition 1–2)" value={moneyShort(fac.deferredCost)} sub={`of ${moneyShort(fac.totalReplacement)} tracked`} p={fac.provenance} />
        <Stat label="Life-safety items open" value={fac.lifeSafetyOpen.length} sub={fac.lifeSafetyOpen.map((a) => a.asset).join(", ") || "none"} p={fac.provenance} />
        <Stat label="Inspections overdue" value={fac.overdueInspections} sub={`as of ${dateShort(AS_OF)}`} p={fac.provenance} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Assets" p={fac.provenance} className="lg:col-span-2" id="fa1">
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
                    <td className="py-1.5 pr-2">{a.asset}<span className="block text-[11px] text-faint">{a.category}</span></td>
                    <td className="py-1.5 pr-2">{"■".repeat(a.condition)}<span className="text-border">{"■".repeat(5 - a.condition)}</span> <span className="text-xs text-muted">{a.condition}/5</span></td>
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
        <Card title="Capital plan by year" p={fac.provenance} id="fa2">
          <SimpleBars rows={fac.capitalByYear.map((x) => ({ year: String(x.year), cost: x.cost }))} xKey="year" yKey="cost" format="money" label="Planned replacement cost" sample={fac.provenance !== "REAL"} />
        </Card>
      </div>
    </div>
  );

  const quality = (
    <Card title="Data feeds for this school" p={m.systems.provenance} id="dq1">
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
      <p className="mt-3 text-xs text-muted">Feeds older than 30 days or under 80% complete raise a Systems alert. SharePoint is mid-rollout in this sample, so its completeness runs lower.</p>
    </Card>
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted"><Link href="/" className="underline underline-offset-2">Radar</Link> / School</nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight"><SchoolName name={school.name} /></h1>
        <p className="text-sm text-muted">{GOVERNANCE_LABEL[school.governance]} · {school.city}</p>
      </div>
      <SampleBanner />
      <Tabs tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "enrollment", label: "Enrollment", content: enrollment },
        { id: "finance", label: "Finance & Tuition", content: finance },
        { id: "facilities", label: "Facilities", content: facilities },
        { id: "data", label: "Data quality", content: quality },
      ]} />
    </div>
  );
}
