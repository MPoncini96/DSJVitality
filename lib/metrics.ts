/**
 * Per-school metrics: the numbers a director would watch. Every metric group
 * carries the provenance of the rows it was computed from.
 */
import {
  consecutiveDeclines, enrollmentTotals, getBirths, getBudget, getCash, getDataAudit, getEnrollment,
  getFacilities, getPipeline, getReceivables, getReenrollment, getSchool, getTuition, getTuitionAssistance, getTuitionUnverified,
  latestEnrollmentYear, provenanceOf, type MixedProvenance,
} from "./data";
import { BASE_YEAR, DEMO_AS_OF, SCENARIO_CAGR_CAP } from "./config";
import type { Provenance, UnverifiedTuition } from "./types";

/** Simulated internal data (demo schools only) is a snapshot as of this date. */
const AS_OF = DEMO_AS_OF;
const AS_OF_DATE = new Date(`${AS_OF}T00:00:00Z`);
const DAY = 86400000;

type P = { provenance: Provenance };
const prov = (...groups: P[][]): MixedProvenance => provenanceOf(groups.flat());

export interface EnrollmentMetrics {
  latestYear: number;
  latest: number | null;
  series: { year: number; total: number }[];
  /** first year of the long trend (BASE_YEAR, 2019-20) */
  baseYear: number;
  /** compound annual change from the base year to the latest year */
  cagr: number | null;
  /** total change from the base year to the latest year */
  changeSinceBase: number | null;
  change1: number | null;
  consecutiveDeclines: number;
  entryGrade: string;
  entrySeries: { year: number; count: number }[];
  entryTrend3: number | null;
  /** Share of last year's students (below the top grade) who appear one grade up this year, 3-year average. */
  cohortRetention: number | null;
  thinGrades: { grade: string; count: number }[];
  byGrade: { year: number; grade: string; count: number }[];
  provenance: MixedProvenance;
}

export interface ReenrollmentMetrics {
  year: number | null;
  rate: number | null;
  priorRate: number | null;
  series: { year: number; rate: number }[];
  provenance: MixedProvenance;
}

/**
 * Births near the school (CDPH) and the school's kindergarten share of them.
 * A child born in year B starts kindergarten in about school year B + 5 (Sept 1 cutoff),
 * so births are a 5-year early signal for the kindergarten pool.
 */
export interface MarketMetrics {
  catchmentZips: string[];
  births: { year: number; births: number }[];
  /** births in the latest year vs. 5 years earlier */
  births5Change: number | null;
  latestBirthYear: number | null;
  /** kindergarten in school year `year` divided by births in `year - 5` */
  kShare: { year: number; k: number; births: number; share: number }[];
  /** average share over the last 3 school years with data */
  share3: number | null;
  /** annualized change from the first 3 to the last 3 years of share */
  shareTrend: number | null;
  provenance: MixedProvenance;
}

/**
 * Enrollment scenarios, not a forecast. Two simple scenarios bracket a range:
 *   trend:  latest x (1 + CAGR since the base year, capped) ^ years ahead
 *   births: latest x average over grades K-8 of births(cohort) / births(today's cohort),
 *           i.e. today's enrollment carried along the local births curve
 * low = the lower of the two each year, high = the higher. Shown as a range only.
 */
export interface ScenarioMetrics {
  years: { year: number; low: number; high: number; trend: number; births: number }[];
  /** the capped CAGR the trend scenario uses */
  trendRate: number | null;
  method: string;
  /** provenance of the inputs (REAL when enrollment and births are REAL) */
  inputs: MixedProvenance;
}

export interface FinanceMetrics {
  closedFy: number | null;
  currentFy: number | null;
  monthsClosed: number;
  revenue: number | null;
  expense: number | null;
  operatingMargin: number | null;
  expenseVarianceYtd: number | null;
  revenueVarianceYtd: number | null;
  daysCash: number | null;
  receivables60PlusPct: number | null;
  receivablesAging: { bucket: string; amount: number }[];
  costPerPupil: number | null;
  tuition: number | null;
  tuitionGap: number | null;
  taDependency: number | null;
  ta: { year: number; applications: number; awards: number; totalAwarded: number }[];
  tuitionSeries: { year: number; tuition: number }[];
  /** latest published (REAL) or simulated rate, with its details */
  tuitionLatest: {
    year: number; tuition: number; parishRate: number | null; yearStated: boolean; notes: string; sourceUrl: string; provenance: Provenance;
  } | null;
  /** third-party listing, shown as UNVERIFIED; never used in any metric */
  tuitionUnverified: UnverifiedTuition | null;
  annualByCategory: { category: string; kind: string; budget: number; actual: number }[];
  provenance: MixedProvenance;
}

export interface FacilitiesMetrics {
  fci: number | null;
  deferredCost: number;
  totalReplacement: number;
  lifeSafetyOpen: { asset: string; condition: number }[];
  overdueInspections: number;
  capitalByYear: { year: number; cost: number }[];
  assets: {
    assetId: string; asset: string; category: string; condition: number; lastInspection: string;
    overdue: boolean; cost: number; priority: string; planYear: number;
  }[];
  provenance: MixedProvenance;
}

export interface SystemsMetrics {
  feeds: { feed: string; lastRefresh: string; daysOld: number; completenessPct: number; issues: number; rowCount: number }[];
  staleFeeds: string[];
  lowCompleteness: string[];
  provenance: MixedProvenance;
}

export interface PipelineMetrics {
  /** Completed months of the current admissions cycle (starts Sept). */
  months: string[];
  inquiriesYtd: number;
  inquiriesPriorYtd: number;
  inquiryPacing: number | null;
  priorCycle: { inquiries: number; tours: number; applications: number; accepted: number; enrolled: number };
  provenance: MixedProvenance;
}

export interface SchoolMetrics {
  schoolId: string;
  enrollment: EnrollmentMetrics;
  reenrollment: ReenrollmentMetrics;
  market: MarketMetrics;
  scenario: ScenarioMetrics;
  finance: FinanceMetrics;
  facilities: FacilitiesMetrics;
  systems: SystemsMetrics;
  pipeline: PipelineMetrics;
}

const gradeOrder = (g: string) => (g === "K" ? 0 : Number(g));

function enrollmentMetrics(schoolId: string): EnrollmentMetrics {
  const rows = getEnrollment().filter((r) => r.schoolId === schoolId);
  const L = rows.length ? Math.max(...rows.map((r) => r.year)) : latestEnrollmentYear();
  const totals = enrollmentTotals([schoolId]);
  const t = new Map(totals.map((x) => [x.year, x.total]));
  const grades = [...new Set(rows.map((r) => r.grade))].sort((a, b) => gradeOrder(a) - gradeOrder(b));
  const entryGrade = grades[0] ?? "K";
  const topGrade = grades.at(-1) ?? "8";
  const count = (y: number, g: string) => rows.find((r) => r.year === y && r.grade === g)?.count;
  const entrySeries = [...new Set(rows.map((r) => r.year))].sort().map((y) => ({ year: y, count: count(y, entryGrade) ?? 0 }));

  const retention: number[] = [];
  for (let y = L - 2; y <= L; y++) {
    let num = 0, den = 0;
    for (let i = 1; i < grades.length; i++) {
      const now = count(y, grades[i]), before = count(y - 1, grades[i - 1]);
      if (now !== undefined && before !== undefined) { num += now; den += before; }
    }
    if (den > 0) retention.push(num / den);
  }

  const span = L - BASE_YEAR;
  const cagr = span > 0 && t.get(L) && t.get(BASE_YEAR) ? (t.get(L)! / t.get(BASE_YEAR)!) ** (1 / span) - 1 : null;
  const e = (y: number) => count(y, entryGrade);
  const entryTrend3 = e(L) && e(L - 3) ? (e(L)! / e(L - 3)!) ** (1 / 3) - 1 : null;
  const isElementary = topGrade !== "12";

  return {
    latestYear: L,
    latest: t.get(L) ?? null,
    series: totals.map((x) => ({ year: x.year, total: x.total })),
    baseYear: BASE_YEAR,
    cagr,
    changeSinceBase: t.get(L) && t.get(BASE_YEAR) ? t.get(L)! / t.get(BASE_YEAR)! - 1 : null,
    change1: t.get(L) && t.get(L - 1) ? t.get(L)! / t.get(L - 1)! - 1 : null,
    consecutiveDeclines: consecutiveDeclines(totals),
    entryGrade,
    entrySeries,
    entryTrend3,
    cohortRetention: retention.length ? retention.reduce((a, b) => a + b, 0) / retention.length : null,
    thinGrades: isElementary
      ? rows.filter((r) => r.year === L && r.count < 15).map((r) => ({ grade: r.grade, count: r.count }))
      : [],
    byGrade: rows.map((r) => ({ year: r.year, grade: r.grade, count: r.count })),
    provenance: prov(rows),
  };
}

function reenrollmentMetrics(schoolId: string): ReenrollmentMetrics {
  const rows = getReenrollment().filter((r) => r.schoolId === schoolId).sort((a, b) => a.year - b.year);
  const series = rows.map((r) => ({ year: r.year, rate: r.reenrolled / r.eligible }));
  return {
    year: rows.at(-1)?.year ?? null,
    rate: series.at(-1)?.rate ?? null,
    priorRate: series.at(-2)?.rate ?? null,
    series,
    provenance: prov(rows),
  };
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

function marketMetrics(schoolId: string, enrollment: EnrollmentMetrics): MarketMetrics {
  const rows = getBirths().filter((r) => r.schoolId === schoolId).sort((a, b) => a.birthYear - b.birthYear);
  const b = new Map(rows.map((r) => [r.birthYear, r.births]));
  const last = rows.at(-1);
  const five = last ? b.get(last.birthYear - 5) : undefined;
  const kShare = enrollment.entryGrade === "K"
    ? enrollment.entrySeries
        .filter((e) => e.count > 0 && b.get(e.year - 5))
        .map((e) => ({ year: e.year, k: e.count, births: b.get(e.year - 5)!, share: e.count / b.get(e.year - 5)! }))
    : [];
  const first3 = kShare.slice(0, 3), last3 = kShare.slice(-3);
  const a1 = avg(first3.map((x) => x.share)), a2 = avg(last3.map((x) => x.share));
  const span = (avg(last3.map((x) => x.year)) ?? 0) - (avg(first3.map((x) => x.year)) ?? 0);
  const enrollRows = getEnrollment().filter((r) => r.schoolId === schoolId);
  return {
    catchmentZips: rows[0]?.catchmentZips ?? [],
    births: rows.map((r) => ({ year: r.birthYear, births: r.births })),
    births5Change: last && five ? last.births / five - 1 : null,
    latestBirthYear: last?.birthYear ?? null,
    kShare,
    share3: a2,
    shareTrend: kShare.length >= 6 && a1 && a2 && span > 0 ? (a2 / a1) ** (1 / span) - 1 : null,
    provenance: rows.length ? prov(rows, enrollRows) : "SAMPLE",
  };
}

function scenarioMetrics(enrollment: EnrollmentMetrics, market: MarketMetrics): ScenarioMetrics {
  const inputs = provenanceOf([enrollment.provenance, market.provenance].map((p) => ({ provenance: p === "REAL" ? ("REAL" as const) : ("SAMPLE" as const) })));
  const method =
    `Trend: latest enrollment grown at the ${enrollment.baseYear}-${String((enrollment.baseYear + 1) % 100).padStart(2, "0")} to latest annual rate, capped at ` +
    `${SCENARIO_CAGR_CAP[0] * 100}% to +${SCENARIO_CAGR_CAP[1] * 100}% a year. Births: latest enrollment scaled by the change in births for the ` +
    "children who will fill grades K-8 that year. The range runs from the lower to the higher scenario.";
  const empty: ScenarioMetrics = { years: [], trendRate: null, method, inputs };
  const L = enrollment.latestYear, latest = enrollment.latest;
  if (latest === null || enrollment.cagr === null || market.latestBirthYear === null) return empty;
  const rate = Math.min(SCENARIO_CAGR_CAP[1], Math.max(SCENARIO_CAGR_CAP[0], enrollment.cagr));
  const b = new Map(market.births.map((x) => [x.year, x.births]));
  // A child in grade k in school year y was born in about y - 5 - k.
  const cohortIndex = (y: number) => {
    const r: number[] = [];
    for (let k = 0; k <= 8; k++) {
      const now = b.get(y - 5 - k), base = b.get(L - 5 - k);
      if (now && base) r.push(now / base);
    }
    return r.length === 9 ? r.reduce((a, x) => a + x, 0) / 9 : null;
  };
  const years: ScenarioMetrics["years"] = [];
  for (let y = L + 1; y - 5 <= market.latestBirthYear; y++) {
    const idx = cohortIndex(y);
    if (idx === null) break;
    const trend = latest * (1 + rate) ** (y - L);
    const births = latest * idx;
    years.push({ year: y, trend: Math.round(trend), births: Math.round(births), low: Math.round(Math.min(trend, births)), high: Math.round(Math.max(trend, births)) });
  }
  return { years, trendRate: rate, method, inputs };
}

function financeMetrics(schoolId: string, enrollment: EnrollmentMetrics): FinanceMetrics {
  const budget = getBudget().filter((r) => r.schoolId === schoolId);
  const fys = [...new Set(budget.map((r) => r.fiscalYear))].sort();
  const closed = fys.filter((fy) => budget.filter((r) => r.fiscalYear === fy).every((r) => r.actual !== null));
  const closedFy = closed.at(-1) ?? null;
  const currentFy = fys.find((fy) => !closed.includes(fy)) ?? null;
  const sum = (rows: typeof budget, k: "budget" | "actual") => rows.reduce((a, r) => a + (r[k] ?? 0), 0);

  const closedRows = budget.filter((r) => r.fiscalYear === closedFy);
  const revenue = closedFy ? sum(closedRows.filter((r) => r.kind === "revenue"), "actual") : null;
  const expense = closedFy ? sum(closedRows.filter((r) => r.kind === "expense"), "actual") : null;

  const curRows = budget.filter((r) => r.fiscalYear === currentFy);
  const monthsClosed = currentFy ? Math.max(0, ...curRows.filter((r) => r.actual !== null).map((r) => r.fiscalMonth)) : 0;
  const ytd = curRows.filter((r) => r.fiscalMonth <= monthsClosed);
  const variance = (kind: string) => {
    const rows = ytd.filter((r) => r.kind === kind);
    const b = sum(rows, "budget");
    return b ? sum(rows, "actual") / b - 1 : null;
  };

  const cash = getCash().filter((r) => r.schoolId === schoolId).sort((a, b) => a.month.localeCompare(b.month));
  const ar = getReceivables().filter((r) => r.schoolId === schoolId).sort((a, b) => a.asOf.localeCompare(b.asOf)).at(-1);

  const tuitionRows = getTuition().filter((r) => r.schoolId === schoolId && r.tuition !== null).sort((a, b) => a.year - b.year);
  // Exact year if present, otherwise the closest year (published tuition is for 2026-27,
  // a year ahead of the latest enrollment).
  const tuitionOf = (y: number) =>
    tuitionRows.length ? [...tuitionRows].sort((a, b) => Math.abs(a.year - y) - Math.abs(b.year - y) || b.year - a.year)[0].tuition : null;
  const tLatest = tuitionRows.at(-1);
  const ta = getTuitionAssistance().filter((r) => r.schoolId === schoolId).sort((a, b) => a.year - b.year);

  // Closed FY N covers school year N-1.
  const closedSchoolYear = closedFy ? closedFy - 1 : null;
  const enrClosed = closedSchoolYear ? enrollment.series.find((s) => s.year === closedSchoolYear)?.total : undefined;
  const costPerPupil = expense !== null && enrClosed ? expense / enrClosed : null;
  const tuitionClosed = closedSchoolYear ? tuitionOf(closedSchoolYear) : null;

  const L = enrollment.latestYear;
  const taLatest = ta.find((r) => r.year === L);
  const tuitionL = tuitionOf(L);
  const gross = enrollment.latest && tuitionL ? enrollment.latest * tuitionL : null;

  const annualByCategory = closedFy
    ? [...new Set(closedRows.map((r) => r.category))].map((c) => {
        const rows = closedRows.filter((r) => r.category === c);
        return { category: c, kind: rows[0].kind, budget: sum(rows, "budget"), actual: sum(rows, "actual") };
      })
    : [];

  return {
    closedFy,
    currentFy,
    monthsClosed,
    revenue,
    expense,
    operatingMargin: revenue && expense !== null ? (revenue - expense) / revenue : null,
    expenseVarianceYtd: variance("expense"),
    revenueVarianceYtd: variance("revenue"),
    daysCash: cash.length && expense ? cash.at(-1)!.cash / (expense / 365) : null,
    receivables60PlusPct: ar ? (ar.days60 + ar.days90Plus) / ar.annualTuitionBilled : null,
    receivablesAging: ar
      ? [
          { bucket: "Current", amount: ar.current },
          { bucket: "30 days", amount: ar.days30 },
          { bucket: "60 days", amount: ar.days60 },
          { bucket: "90+ days", amount: ar.days90Plus },
        ]
      : [],
    costPerPupil,
    tuition: tuitionClosed,
    tuitionGap: costPerPupil !== null && tuitionClosed !== null ? costPerPupil - tuitionClosed : null,
    taDependency: taLatest && gross ? taLatest.totalAwarded / gross : null,
    ta: ta.map((r) => ({ year: r.year, applications: r.applications, awards: r.awards, totalAwarded: r.totalAwarded })),
    tuitionSeries: tuitionRows.map((r) => ({ year: r.year, tuition: r.tuition! })),
    tuitionLatest: tLatest
      ? { year: tLatest.year, tuition: tLatest.tuition!, parishRate: tLatest.parishRate, yearStated: tLatest.yearStated, notes: tLatest.notes, sourceUrl: tLatest.sourceUrl, provenance: tLatest.provenance }
      : null,
    tuitionUnverified: getTuitionUnverified().find((u) => u.schoolId === schoolId) ?? null,
    annualByCategory,
    // Tuition carries its own provenance (tuitionLatest); the finance cards are simulated.
    provenance: prov(budget, cash, ar ? [ar] : [], ta),
  };
}

function facilitiesMetrics(schoolId: string): FacilitiesMetrics {
  const rows = getFacilities().filter((r) => r.schoolId === schoolId);
  const assets = rows.map((r) => {
    const due = new Date(`${r.lastInspection}T00:00:00Z`);
    due.setUTCMonth(due.getUTCMonth() + r.inspectionIntervalMonths);
    return {
      assetId: r.assetId, asset: r.asset, category: r.category, condition: r.condition, lastInspection: r.lastInspection,
      overdue: due < AS_OF_DATE, cost: r.estReplacementCost, priority: r.priority, planYear: r.capitalPlanYear,
    };
  });
  const deferredCost = assets.filter((a) => a.condition <= 2).reduce((s, a) => s + a.cost, 0);
  const totalReplacement = assets.reduce((s, a) => s + a.cost, 0);
  const byYear = new Map<number, number>();
  for (const a of assets) byYear.set(a.planYear, (byYear.get(a.planYear) ?? 0) + a.cost);
  return {
    fci: totalReplacement ? deferredCost / totalReplacement : null,
    deferredCost,
    totalReplacement,
    lifeSafetyOpen: assets.filter((a) => a.category === "Life safety" && a.condition <= 2).map((a) => ({ asset: a.asset, condition: a.condition })),
    overdueInspections: assets.filter((a) => a.overdue).length,
    capitalByYear: [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, cost]) => ({ year, cost })),
    assets: assets.sort((a, b) => a.condition - b.condition || b.cost - a.cost),
    provenance: prov(rows),
  };
}

function systemsMetrics(schoolId: string): SystemsMetrics {
  const rows = getDataAudit().filter((r) => r.schoolId === schoolId);
  const feeds = rows.map((r) => ({
    feed: r.feed, lastRefresh: r.lastRefresh,
    daysOld: Math.round((AS_OF_DATE.getTime() - new Date(`${r.lastRefresh}T00:00:00Z`).getTime()) / DAY),
    completenessPct: r.completenessPct, issues: r.issues, rowCount: r.rowCount,
  }));
  return {
    feeds,
    staleFeeds: feeds.filter((f) => f.daysOld > 30).map((f) => f.feed),
    lowCompleteness: feeds.filter((f) => f.completenessPct < 85).map((f) => f.feed),
    provenance: prov(rows),
  };
}

function pipelineMetrics(schoolId: string): PipelineMetrics {
  const rows = getPipeline().filter((r) => r.schoolId === schoolId);
  const asOfMonth = AS_OF.slice(0, 7);
  const cycleStartYear = Number(AS_OF.slice(0, 4)) - (Number(AS_OF.slice(5, 7)) >= 9 ? 0 : 1);
  const months = rows.map((r) => r.month).filter((m) => m >= `${cycleStartYear}-09` && m < asOfMonth).sort();
  const shift = (m: string) => `${Number(m.slice(0, 4)) - 1}${m.slice(4)}`;
  const sumOf = (ms: string[]) => rows.filter((r) => ms.includes(r.month)).reduce((a, r) => a + r.inquiries, 0);
  const ytd = sumOf(months), prior = sumOf(months.map(shift));
  const priorCycleRows = rows.filter((r) => r.month >= `${cycleStartYear - 1}-09` && r.month < `${cycleStartYear}-09`);
  const tot = (k: "inquiries" | "tours" | "applications" | "accepted" | "enrolled") => priorCycleRows.reduce((a, r) => a + r[k], 0);
  return {
    months,
    inquiriesYtd: ytd,
    inquiriesPriorYtd: prior,
    inquiryPacing: prior ? ytd / prior - 1 : null,
    priorCycle: { inquiries: tot("inquiries"), tours: tot("tours"), applications: tot("applications"), accepted: tot("accepted"), enrolled: tot("enrolled") },
    provenance: prov(rows),
  };
}

const memo = new Map<string, SchoolMetrics>();

export function schoolMetrics(schoolId: string): SchoolMetrics {
  const hit = memo.get(schoolId);
  if (hit) return hit;
  const school = getSchool(schoolId);
  if (!school) throw new Error(`Unknown school ${schoolId}`);
  const enrollment = enrollmentMetrics(schoolId);
  const market = marketMetrics(schoolId, enrollment);
  const m: SchoolMetrics = {
    schoolId,
    enrollment,
    reenrollment: reenrollmentMetrics(schoolId),
    market,
    scenario: scenarioMetrics(enrollment, market),
    finance: financeMetrics(schoolId, enrollment),
    facilities: facilitiesMetrics(schoolId),
    systems: systemsMetrics(schoolId),
    pipeline: pipelineMetrics(schoolId),
  };
  memo.set(schoolId, m);
  return m;
}

/** Test helper. */
export function clearMetricsCache() {
  memo.clear();
}

