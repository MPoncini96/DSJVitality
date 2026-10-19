/**
 * Simulated data generator for the DEMO system. Every row it writes is tagged
 * provenance=SAMPLE and belongs to a fictional school ("School A" ... "School Y").
 *
 * The demo schools are not stand-ins for real schools. Nothing here reads a real
 * school's figures: sizes, trends, births, tuition and finances are drawn at random
 * (seeded) from generic ranges. A demo school cannot be mapped back to a real one,
 * so simulated status (turnaround phase, deficits, overdue items) is never attached
 * to a real school's name.
 *
 * The only thing read from the real data is the latest school year in
 * data/enrollment.csv, so the demo uses the same reference year as the rest of the site.
 *
 * Deterministic: same SEED -> byte-identical output.
 * Run: npm run data:sample
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, toCsv } from "../lib/csv";
import { Rng, hashString } from "../lib/rng";
import type { BudgetCategory } from "../lib/types";

export const SEED = 20261016;
const SOURCE = `scripts/generate_sample.ts seed=${SEED}`;
const AS_OF = new Date(Date.UTC(2026, 9, 1)); // lib/config.ts DEMO_AS_OF; fixed so output is deterministic
const root = join(__dirname, "..");

const realEnrollment = join(root, "data", "enrollment.csv");
/** Reference school year: the latest year in the real CDE file (2025 = 2025-26). */
const LAST_YEAR = existsSync(realEnrollment)
  ? Math.max(...parseCsv(readFileSync(realEnrollment, "utf8")).map((r) => Number(r.year)))
  : 2025;
const FIRST_YEAR = LAST_YEAR - 9;
const FIRST_BIRTH_YEAR = 2005;
const LAST_BIRTH_YEAR = LAST_YEAR - 1; // births are published about a year behind
const CURRENT_FY = 2027; // Jul 2026 - Jun 2027; actuals exist for Jul-Sep only
const ACTUAL_MONTHS_CURRENT_FY = 3;

mkdirSync(join(root, "data", "sample"), { recursive: true });
const out = (file: string, text: string) => writeFileSync(join(root, "data", "sample", file), text);
// Files from the old generator (simulated rows keyed to real schools) must not linger.
for (const f of ["demographics.csv"]) rmSync(join(root, "data", "sample", f), { force: true });

// ---------------------------------------------------------------- demo schools
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXY".split("");
interface DemoSchool { id: string; name: string; band: "small" | "medium" | "large" }
const BAND_RANGE = { small: [70, 170], medium: [170, 300], large: [300, 480] } as const;
const schools: DemoSchool[] = LETTERS.map((L) => {
  const rng = new Rng(SEED ^ hashString(`demo:${L}:band`));
  const band = rng.pick(["small", "small", "medium", "medium", "medium", "large"] as const);
  return { id: `demo-${L.toLowerCase()}`, name: `School ${L}`, band };
});

const rngFor = (schoolId: string, stream: string) => new Rng(SEED ^ hashString(`${schoolId}:${stream}`));
const round = (n: number, step = 1) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------- births near each demo school
interface BirthOut { school_id: string; birth_year: number; births: number; catchment_zips: string; provenance: string; source: string }
const births: BirthOut[] = [];
const birthsOf = new Map<string, Map<number, number>>();
for (const s of schools) {
  const rng = rngFor(s.id, "births");
  let b = rng.range(2500, 9000);
  const trend = rng.normal(-0.014, 0.01);
  const m = new Map<number, number>();
  for (let y = FIRST_BIRTH_YEAR; y <= LAST_BIRTH_YEAR; y++) {
    if (y > FIRST_BIRTH_YEAR) b *= 1 + trend + rng.normal(0, 0.02);
    m.set(y, Math.round(b));
    births.push({ school_id: s.id, birth_year: y, births: Math.round(b), catchment_zips: "", provenance: "SAMPLE", source: SOURCE });
  }
  birthsOf.set(s.id, m);
}

// ---------------------------------------------------------------- enrollment (K-8)
const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
interface EnrollRow { school_id: string; year: number; grade: string; count: number; provenance: string; source: string }
const enrollment: EnrollRow[] = [];
const totals = new Map<string, Map<number, number>>();
const entryByYear = new Map<string, Map<number, number>>();
for (const s of schools) {
  const rng = rngFor(s.id, "enrollment");
  const [lo, hi] = BAND_RANGE[s.band];
  const total0 = rng.range(lo, hi);
  const gpr = GRADES.map((_, i) => (i === 0 ? 1 : i >= 6 ? 0.95 : 0.98));
  const weights: number[] = [];
  GRADES.forEach((_, i) => weights.push(i === 0 ? 1 : weights[i - 1] * gpr[i]));
  const wSum = weights.reduce((a, b) => a + b, 0);
  // Kindergarten is a share of births five years earlier; the share drifts.
  const b = birthsOf.get(s.id)!;
  let share = ((total0 / wSum) * weights[0]) / b.get(FIRST_YEAR - 5)!;
  const shareDrift = clamp(rng.normal(-0.004, 0.022), -0.06, 0.04);
  let prev = weights.map((w) => (total0 / wSum) * w * (1 + rng.normal(0, 0.06)));
  const tMap = new Map<number, number>(), eMap = new Map<number, number>();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    let counts: number[];
    if (year === FIRST_YEAR) counts = prev;
    else {
      share *= 1 + shareDrift + rng.normal(0, 0.06);
      let k = share * b.get(year - 5)!;
      if (year === 2020) k *= 1 + rng.normal(-0.15, 0.06); // pandemic-year dip
      counts = GRADES.map((_, i) => (i === 0 ? k : prev[i - 1] * clamp(rng.normal(gpr[i] + shareDrift * 0.3, 0.03), 0.8, 1.08)));
    }
    counts = counts.map((c) => Math.max(4, Math.round(c)));
    counts.forEach((c, i) => enrollment.push({ school_id: s.id, year, grade: GRADES[i], count: c, provenance: "SAMPLE", source: SOURCE }));
    tMap.set(year, counts.reduce((a, c) => a + c, 0));
    eMap.set(year, counts[0]);
    prev = counts;
  }
  totals.set(s.id, tMap);
  entryByYear.set(s.id, eMap);
}
/** Enrollment for a year, carrying the reference year forward for budgets that run ahead of it. */
const enrOf = (id: string, y: number) => totals.get(id)!.get(Math.min(y, LAST_YEAR))!;

// ---------------------------------------------------------------- tuition (rates through the next school year)
interface TuitionOut { school_id: string; year: number; tuition: number; provenance: string; source_url: string }
const tuition: TuitionOut[] = [];
const tuitionOf = new Map<string, Map<number, number>>();
for (const s of schools) {
  const rng = rngFor(s.id, "tuition");
  let t = rng.range(8000, 12500);
  const m = new Map<number, number>();
  for (let year = FIRST_YEAR; year <= LAST_YEAR + 1; year++) {
    if (year > FIRST_YEAR) t *= 1 + rng.range(0.03, 0.065);
    m.set(year, round(t, 50));
    tuition.push({ school_id: s.id, year, tuition: round(t, 50), provenance: "SAMPLE", source_url: "" });
  }
  tuitionOf.set(s.id, m);
}

// ---------------------------------------------------------------- budget vs actual (monthly)
const REVENUE: BudgetCategory[] = ["tuition_revenue", "fundraising", "parish_subsidy", "other_revenue"];
const EXPENSE: BudgetCategory[] = ["salaries_benefits", "facilities", "instructional", "administrative"];
// Fiscal month 1 = July ... 12 = June
const SEASON: Record<string, number[]> = {
  tuition_revenue: [0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0],
  fundraising: [0.3, 0.5, 0.8, 1, 1.2, 2.2, 0.6, 0.8, 3.0, 1.0, 0.8, 0.3],
  parish_subsidy: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  other_revenue: [0.5, 1.5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  salaries_benefits: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  facilities: [2.2, 1.8, 0.8, 0.7, 0.7, 0.8, 0.7, 0.7, 0.8, 0.7, 0.8, 1.8],
  instructional: [0.6, 2.4, 1.2, 1, 0.9, 0.8, 1, 0.9, 0.8, 0.8, 0.8, 0.8],
  administrative: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
};
interface BudgetOut { school_id: string; fiscal_year: number; fiscal_month: number; category: string; kind: string; budget: number; actual: number | ""; provenance: string }
const budget: BudgetOut[] = [];
interface CashOut { school_id: string; month: string; cash: number; provenance: string }
const cash: CashOut[] = [];
interface ARout { school_id: string; as_of: string; current: number; days_30: number; days_60: number; days_90_plus: number; annual_tuition_billed: number; provenance: string }
const receivables: ARout[] = [];
const structuralOf = new Map<string, number>();
for (const s of schools) {
  const rng = rngFor(s.id, "budget");
  const discount = rng.range(0.06, 0.16);
  const fundraisingPct = rng.range(0.05, 0.12);
  const subsidyPct = rng.range(0, 0.08);
  // >0 = expenses run above revenue. Shrinking schools tend to run tighter budgets.
  const t = totals.get(s.id)!;
  const structural = rng.normal(-0.006, 0.03) - (t.get(LAST_YEAR)! / t.get(2019)! - 1) * 0.1;
  structuralOf.set(s.id, structural);
  const reserveDays = clamp(rng.normal(70 - structural * 600, 30), 8, 180); // weaker schools hold less cash
  for (let fy = 2023; fy <= CURRENT_FY; fy++) {
    const schoolYear = fy - 1;
    const tuitionRev = enrOf(s.id, schoolYear) * tuitionOf.get(s.id)!.get(schoolYear)! * (1 - discount);
    const annualBudget: Record<string, number> = {
      tuition_revenue: tuitionRev,
      fundraising: tuitionRev * fundraisingPct,
      parish_subsidy: tuitionRev * subsidyPct,
      other_revenue: tuitionRev * 0.03,
    };
    const revTotal = REVENUE.reduce((a, c) => a + annualBudget[c], 0);
    const expTotal = revTotal * (1 + structural * 0.5);
    Object.assign(annualBudget, {
      salaries_benefits: expTotal * 0.7,
      facilities: expTotal * 0.08,
      instructional: expTotal * 0.08,
      administrative: expTotal * 0.14,
    });
    for (const cat of [...REVENUE, ...EXPENSE]) {
      const isRev = REVENUE.includes(cat);
      const w = SEASON[cat];
      const wSum = w.reduce((a, b) => a + b, 0);
      const bias = isRev ? rng.normal(-0.01, 0.03) : rng.normal(structural * 0.5, 0.025);
      for (let m = 1; m <= 12; m++) {
        const b = (annualBudget[cat] * w[m - 1]) / wSum;
        const a = b * (1 + bias + rng.normal(0, 0.05));
        const hasActual = fy < CURRENT_FY || m <= ACTUAL_MONTHS_CURRENT_FY;
        budget.push({
          school_id: s.id, fiscal_year: fy, fiscal_month: m, category: cat, kind: isRev ? "revenue" : "expense",
          budget: round(b), actual: hasActual ? round(Math.max(0, a)) : "", provenance: "SAMPLE",
        });
      }
    }
    // Month-end cash: reserve level plus a seasonal swing (tuition arrives Aug-May, payroll is flat).
    if (fy >= 2026) {
      const dailyExpense = expTotal / 365;
      const swing = [0.55, 1.15, 1.25, 1.15, 1.05, 1.0, 0.95, 0.9, 0.85, 0.8, 0.7, 0.5];
      const drift = fy === CURRENT_FY ? 1 - structural * 2 : 1;
      for (let m = 1; m <= 12; m++) {
        if (fy === CURRENT_FY && m > ACTUAL_MONTHS_CURRENT_FY) break;
        const d = new Date(Date.UTC(fy - 1, 6 + m - 1, 1));
        cash.push({
          school_id: s.id, month: iso(d).slice(0, 7),
          cash: round(Math.max(0, dailyExpense * reserveDays * swing[m - 1] * drift * (1 + rng.normal(0, 0.05))), 100),
          provenance: "SAMPLE",
        });
      }
    }
    if (fy === CURRENT_FY) {
      const delinquency = clamp(rng.normal(0.04 + structural, 0.02), 0.005, 0.15);
      const outstanding = tuitionRev * delinquency;
      const late = clamp(rng.normal(0.35 + structural * 3, 0.1), 0.05, 0.8);
      receivables.push({
        school_id: s.id, as_of: iso(new Date(AS_OF.getTime() - 86400000)),
        current: round(outstanding * (1 - late), 100), days_30: round(outstanding * late * 0.45, 100),
        days_60: round(outstanding * late * 0.25, 100), days_90_plus: round(outstanding * late * 0.3, 100),
        annual_tuition_billed: round(tuitionRev, 100), provenance: "SAMPLE",
      });
    }
  }
}

// ---------------------------------------------------------------- tuition assistance (TADS-style)
interface TAOut { school_id: string; year: number; applications: number; awards: number; total_awarded: number; provenance: string }
const ta: TAOut[] = [];
for (const s of schools) {
  const rng = rngFor(s.id, "ta");
  const need = rng.range(0.15, 0.45);
  for (let year = LAST_YEAR - 3; year <= LAST_YEAR; year++) {
    const applications = Math.round(enrOf(s.id, year) * need * (1 + rng.normal(0, 0.06)));
    const awards = Math.round(applications * rng.range(0.7, 0.92));
    const avg = tuitionOf.get(s.id)!.get(year)! * rng.range(0.15, 0.35);
    ta.push({ school_id: s.id, year, applications, awards, total_awarded: round(awards * avg, 100), provenance: "SAMPLE" });
  }
}

// ---------------------------------------------------------------- prospective-family pipeline (monthly)
const W_INQ = [1.4, 1.0, 0.7, 0.5, 0.4, 0.3, 0.3, 0.5, 0.9, 1.6, 1.7, 1.3];
const W_APP = [1.8, 1.6, 0.6, 0.4, 0.3, 0.2, 0.2, 0.2, 0.3, 0.5, 0.9, 1.4];
const W_ACC = [0.4, 1.2, 2.2, 1.4, 0.8, 0.5, 0.4, 0.3, 0.2, 0.2, 0.2, 0.2];
const W_ENR = [0.1, 0.4, 1.6, 2.0, 1.4, 1.0, 0.8, 0.8, 0.3, 0.1, 0.1, 0.1];
const norm = (w: number[]) => w.map((x) => x / w.reduce((a, b) => a + b, 0));
interface PipeOut { school_id: string; month: string; inquiries: number; tours: number; applications: number; accepted: number; enrolled: number; provenance: string }
const pipeline: PipeOut[] = [];
for (const s of schools) {
  const rng = rngFor(s.id, "pipeline");
  const conv = { tour: rng.range(0.4, 0.6), app: rng.range(0.3, 0.5), acc: rng.range(0.7, 0.9), yield: rng.range(0.6, 0.85) };
  for (let i = 0; i < 26; i++) {
    const d = new Date(Date.UTC(2024, 8 + i, 1)); // 2024-09 .. 2026-10
    if (d > AS_OF) break;
    const cal = d.getUTCMonth();
    const target = entryByYear.get(s.id)!.get(LAST_YEAR)! * 1.08;
    const inqYear = target / (conv.app * conv.acc * conv.yield);
    const k = 1 + rng.normal(0, 0.12);
    const inquiries = Math.round(inqYear * norm(W_INQ)[cal] * k);
    pipeline.push({
      school_id: s.id, month: iso(d).slice(0, 7), inquiries, tours: Math.round(inquiries * conv.tour),
      applications: Math.round(inqYear * conv.app * norm(W_APP)[cal] * k),
      accepted: Math.round(inqYear * conv.app * conv.acc * norm(W_ACC)[cal] * k),
      enrolled: Math.round(inqYear * conv.app * conv.acc * conv.yield * norm(W_ENR)[cal] * k),
      provenance: "SAMPLE",
    });
  }
}

// ---------------------------------------------------------------- facilities
// Each school gets a target facility condition index drawn from 8-45% (a realistic
// range for older parish campuses). Assets are rated so the poor-condition share of
// replacement cost lands on that target, so FCI 0% / Facilities 100 cannot happen.
const FCI_RANGE: [number, number] = [0.08, 0.45];
const ASSETS: { asset: string; category: string; cost: [number, number] }[] = [
  { asset: "Roof", category: "Envelope", cost: [180000, 650000] },
  { asset: "HVAC system", category: "Mechanical", cost: [150000, 900000] },
  { asset: "Boiler", category: "Mechanical", cost: [60000, 250000] },
  { asset: "Plumbing (domestic water)", category: "Mechanical", cost: [40000, 220000] },
  { asset: "Electrical service panel", category: "Electrical", cost: [35000, 160000] },
  { asset: "Fire alarm system", category: "Life safety", cost: [45000, 180000] },
  { asset: "Classroom windows", category: "Envelope", cost: [60000, 300000] },
  { asset: "Parking lot / blacktop", category: "Site", cost: [50000, 260000] },
  { asset: "Playground equipment", category: "Site", cost: [30000, 140000] },
  { asset: "Gym floor", category: "Interior", cost: [40000, 150000] },
  { asset: "Restrooms (ADA)", category: "Interior", cost: [50000, 240000] },
  { asset: "Access control & cameras", category: "Life safety", cost: [25000, 120000] },
];
interface FacOut { school_id: string; asset_id: string; asset: string; category: string; condition: number; last_inspection: string; inspection_interval_months: number; est_replacement_cost: number; priority: string; capital_plan_year: number; provenance: string }
const facilities: FacOut[] = [];
for (const s of schools) {
  const rng = rngFor(s.id, "facilities");
  const target = rng.range(...FCI_RANGE);
  // Life-safety systems go last in the rating order: they are usually kept up first.
  const chosen = rng.shuffle(ASSETS).slice(0, rng.int(7, 11)).map((a) => ({ ...a, cost: rng.range(a.cost[0], a.cost[1]) }))
    .sort((a, b) => Number(a.category === "Life safety") - Number(b.category === "Life safety"));
  // Rate assets poor (1-2), in shuffled order, until the poor share reaches the target.
  const total = chosen.reduce((a, x) => a + x.cost, 0);
  let poor = 0;
  const isPoor = chosen.map((x) => {
    if (poor / total >= target) return false;
    poor += x.cost;
    return true;
  });
  // Rescale poor-asset costs so the share is exactly the target.
  const P = chosen.filter((_, i) => isPoor[i]).reduce((a, x) => a + x.cost, 0);
  const Q = total - P;
  const k = (target * Q) / ((1 - target) * P);
  chosen.forEach((a, i) => {
    const condition = isPoor[i] ? rng.pick([1, 2, 2]) : rng.pick([3, 3, 4, 4, 5]);
    const interval = rng.pick([12, 12, 24, 36]);
    const last = new Date(AS_OF.getTime() - rng.int(20, 560) * 86400000);
    const planYear = condition === 1 ? 2027 : condition === 2 ? rng.int(2027, 2028) : condition === 3 ? rng.int(2029, 2031) : rng.int(2032, 2036);
    const priority = condition <= 2 ? "High" : condition === 3 ? (rng.float() < 0.3 ? "High" : "Medium") : "Low";
    facilities.push({
      school_id: s.id, asset_id: `${s.id}-A${String(i + 1).padStart(2, "0")}`, asset: a.asset, category: a.category,
      condition, last_inspection: iso(last), inspection_interval_months: interval,
      est_replacement_cost: round(isPoor[i] ? a.cost * k : a.cost, 1000), priority, capital_plan_year: planYear,
      provenance: "SAMPLE",
    });
  });
}

// ---------------------------------------------------------------- data-quality audit
const FEEDS = ["TADS", "Power BI", "SharePoint", "Workday", "QuickBooks"] as const;
interface AuditOut { school_id: string; feed: string; last_refresh: string; row_count: number; completeness_pct: number; issues: number; provenance: string }
const audit: AuditOut[] = [];
for (const s of schools) {
  const rng = rngFor(s.id, "audit");
  const enr = enrOf(s.id, LAST_YEAR);
  for (const feed of FEEDS) {
    const stale = rng.float() < 0.06;
    const days = stale ? rng.int(45, 120) : rng.int(0, 21);
    const completeness = clamp(rng.normal(feed === "SharePoint" ? 84 : 95, 4), 60, 100);
    audit.push({
      school_id: s.id, feed, last_refresh: iso(new Date(AS_OF.getTime() - days * 86400000)),
      row_count: Math.round(enr * { TADS: 3.2, "Power BI": 12, SharePoint: 1.4, Workday: 0.25, QuickBooks: 40 }[feed] * rng.range(0.9, 1.1)),
      completeness_pct: Math.round(completeness * 10) / 10,
      issues: Math.max(0, Math.round(rng.normal((100 - completeness) * 0.8, 2))),
      provenance: "SAMPLE",
    });
  }
}

// ---------------------------------------------------------------- re-enrollment
// Families returning in fall of school year Y (counted the spring before). Kept
// consistent with the demo enrollment: a school whose cohorts shrink re-enrolls fewer.
interface ReOut { school_id: string; year: number; eligible: number; reenrolled: number; provenance: string }
const reenrollment: ReOut[] = [];
for (const s of schools) {
  const rng = rngFor(s.id, "reenroll");
  const rows = enrollment.filter((r) => r.school_id === s.id);
  for (let year = LAST_YEAR - 3; year <= LAST_YEAR; year++) {
    const eligible = rows.filter((r) => r.year === year - 1 && r.grade !== "8").reduce((a, r) => a + r.count, 0);
    const continuing = rows.filter((r) => r.year === year && r.grade !== "K").reduce((a, r) => a + r.count, 0);
    const rate = clamp((continuing / eligible) * rng.range(0.9, 0.97), 0.7, 0.99);
    reenrollment.push({ school_id: s.id, year, eligible, reenrolled: Math.round(eligible * rate), provenance: "SAMPLE" });
  }
}

// ---------------------------------------------------------------- turnaround program (roster + actions)
// The roster is a simulated decision: the five weakest demo schools on a simple screen
// (enrollment change since the base year + budget structure).
const screen = schools
  .map((s) => {
    const t = totals.get(s.id)!;
    const ch = t.get(LAST_YEAR)! / t.get(2019)! - 1;
    return { id: s.id, score: ch - structuralOf.get(s.id)! * 2 };
  })
  .sort((a, b) => a.score - b.score)
  .slice(0, 5);
const PHASES = ["Assess", "Plan", "Implement", "Implement", "Monitor"] as const;
const ACTIONS: { area: string; action: string; owner: string; metric: string }[] = [
  { area: "Enrollment", action: "Personal re-enrollment conversations with every returning family before the deposit deadline", owner: "Principal", metric: "Re-enrollment rate" },
  { area: "Enrollment", action: "TK/pre-K feeder outreach with parish ministries and local preschools", owner: "Director of Enrollment", metric: "K applications" },
  { area: "Marketing", action: "Inquiry follow-up within 48 hours; log every inquiry in the shared pipeline", owner: "Director of Enrollment", metric: "Inquiry-to-tour rate" },
  { area: "Finance", action: "Bring tuition-assistance discount rate inside the guideline band", owner: "Business Manager", metric: "Discount rate" },
  { area: "Finance", action: "Monthly budget-vs-actual review with pastor and principal", owner: "Business Manager", metric: "Expense variance YTD" },
  { area: "Finance", action: "Collections plan for balances over 60 days (payment plans through TADS)", owner: "Business Manager", metric: "Receivables 60+ days" },
  { area: "Facilities", action: "Fund and schedule life-safety repairs before any discretionary capital", owner: "Pastor", metric: "Life-safety items open" },
  { area: "Systems", action: "Clean family records in TADS before the assistance cycle opens", owner: "Office Manager", metric: "Record completeness" },
];
interface TOut { school_id: string; entered: string; phase: string; lead: string; next_checkin: string; provenance: string }
interface TAct { school_id: string; action_id: string; area: string; action: string; owner_role: string; due: string; status: string; metric: string; provenance: string }
const turnaround: TOut[] = [];
const turnaroundActions: TAct[] = [];
screen.forEach((x, i) => {
  const rng = rngFor(x.id, "turnaround");
  const phase = PHASES[i];
  const entered = new Date(Date.UTC(2025, 1 + rng.int(0, 10), 1));
  turnaround.push({
    school_id: x.id, entered: iso(entered), phase, lead: "Director of School Operational Vitality",
    next_checkin: iso(new Date(AS_OF.getTime() + rng.int(5, 60) * 86400000)), provenance: "SAMPLE",
  });
  if (phase === "Assess") return; // no action plan yet
  rng.shuffle(ACTIONS).slice(0, rng.int(4, 6)).forEach((a, j) => {
    const due = new Date(AS_OF.getTime() + rng.int(-60, 200) * 86400000);
    const status = phase === "Plan" ? "Not started"
      : due < AS_OF ? rng.pick(["Done", "Done", "At risk"]) : rng.pick(["On track", "On track", "At risk", "Not started"]);
    turnaroundActions.push({
      school_id: x.id, action_id: `${x.id}-T${j + 1}`, area: a.area, action: a.action, owner_role: a.owner,
      due: iso(due), status, metric: a.metric, provenance: "SAMPLE",
    });
  });
});

// ---------------------------------------------------------------- write
out("demo_schools.csv", toCsv(schools.map((s) => ({ id: s.id, name: s.name, size_band: s.band, provenance: "SAMPLE" })), ["id", "name", "size_band", "provenance"]));
out("births.csv", toCsv(births, ["school_id", "birth_year", "births", "catchment_zips", "provenance", "source"]));
out("enrollment.csv", toCsv(enrollment, ["school_id", "year", "grade", "count", "provenance", "source"]));
out("tuition.csv", toCsv(tuition, ["school_id", "year", "tuition", "provenance", "source_url"]));
out("budget_actual.csv", toCsv(budget, ["school_id", "fiscal_year", "fiscal_month", "category", "kind", "budget", "actual", "provenance"]));
out("tuition_assistance.csv", toCsv(ta, ["school_id", "year", "applications", "awards", "total_awarded", "provenance"]));
out("pipeline.csv", toCsv(pipeline, ["school_id", "month", "inquiries", "tours", "applications", "accepted", "enrolled", "provenance"]));
out("facilities.csv", toCsv(facilities, ["school_id", "asset_id", "asset", "category", "condition", "last_inspection", "inspection_interval_months", "est_replacement_cost", "priority", "capital_plan_year", "provenance"]));
out("data_audit.csv", toCsv(audit, ["school_id", "feed", "last_refresh", "row_count", "completeness_pct", "issues", "provenance"]));
out("reenrollment.csv", toCsv(reenrollment, ["school_id", "year", "eligible", "reenrolled", "provenance"]));
out("cash_monthly.csv", toCsv(cash, ["school_id", "month", "cash", "provenance"]));
out("receivables.csv", toCsv(receivables, ["school_id", "as_of", "current", "days_30", "days_60", "days_90_plus", "annual_tuition_billed", "provenance"]));
out("turnaround.csv", toCsv(turnaround, ["school_id", "entered", "phase", "lead", "next_checkin", "provenance"]));
out("turnaround_actions.csv", toCsv(turnaroundActions, ["school_id", "action_id", "area", "action", "owner_role", "due", "status", "metric", "provenance"]));

console.log(
  [
    `demo schools ${schools.length}`, `births ${births.length}`, `enrollment ${enrollment.length}`, `tuition ${tuition.length}`,
    `budget_actual ${budget.length}`, `tuition_assistance ${ta.length}`, `pipeline ${pipeline.length}`, `facilities ${facilities.length}`,
    `data_audit ${audit.length}`, `reenrollment ${reenrollment.length}`, `cash ${cash.length}`, `receivables ${receivables.length}`,
    `turnaround ${turnaround.length}/${turnaroundActions.length}`, `reference year ${LAST_YEAR}`,
  ].join(" | ")
);
