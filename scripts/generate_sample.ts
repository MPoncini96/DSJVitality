/**
 * SAMPLE data generator. Every row it writes is tagged provenance=SAMPLE.
 *
 * Nothing here is real or estimated from any school's actual figures.
 * School size is assigned from generic size bands at random (seeded), NOT from
 * knowledge of a real school's size. When REAL data arrives (e.g. CDE enrollment),
 * replace the matching file and the UI badges switch automatically.
 *
 * Deterministic: same SEED -> byte-identical output.
 * Run: npm run data:sample
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, toCsv } from "../lib/csv";
import { Rng, hashString } from "../lib/rng";
import type { BudgetCategory } from "../lib/types";

export const SEED = 20261016;
const SOURCE = `scripts/generate_sample.ts seed=${SEED}`;
const AS_OF = new Date(Date.UTC(2026, 9, 1)); // 2026-10-01, fixed so output is deterministic
const FIRST_YEAR = 2016; // school year 2016-17
const LAST_YEAR = 2026; // school year 2026-27 (fall census already taken by the as-of date)
const CURRENT_FY = 2027; // Jul 2026 - Jun 2027; actuals exist for Jul-Sep only
const ACTUAL_MONTHS_CURRENT_FY = 3;

const root = join(__dirname, "..");
mkdirSync(join(root, "data", "sample"), { recursive: true });
const out = (file: string, text: string) => writeFileSync(join(root, "data", "sample", file), text);

interface SchoolLite {
  id: string;
  zip: string;
  governance: string;
  /** From the school's published name only ("High School" / "College Preparatory"). */
  isHS: boolean;
}
const schools: SchoolLite[] = parseCsv(readFileSync(join(root, "data", "schools.csv"), "utf8")).map((r) => ({
  id: r.id,
  zip: r.zip,
  governance: r.governance,
  isHS: /High School|College Preparatory/.test(r.name),
}));

const rngFor = (schoolId: string, stream: string) => new Rng(SEED ^ hashString(`${schoolId}:${stream}`));
const round = (n: number, step = 1) => Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const iso = (d: Date) => d.toISOString().slice(0, 10);

// ---------------------------------------------------------------- enrollment
const ELEM_GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];
const HS_GRADES = ["9", "10", "11", "12"];
const ELEM_BANDS = { small: [140, 210], medium: [210, 300], large: [300, 420] } as const;
const HS_BAND = [700, 1500] as const;

interface EnrollRow { school_id: string; year: number; grade: string; count: number; provenance: string; source: string; size_band: string }
const enrollment: EnrollRow[] = [];
const totals = new Map<string, Map<number, number>>(); // schoolId -> year -> total
const entryByYear = new Map<string, Map<number, number>>(); // entry grade count

for (const s of schools) {
  const rng = rngFor(s.id, "enrollment");
  const isHS = s.isHS;
  const grades = isHS ? HS_GRADES : ELEM_GRADES;
  const bandName = isHS ? "high_school" : rng.pick(["small", "medium", "large"] as const);
  const [lo, hi] = isHS ? HS_BAND : ELEM_BANDS[bandName as keyof typeof ELEM_BANDS];
  const total0 = rng.range(lo, hi);

  // Grade progression ratios: share of grade g-1 that continues to grade g next year.
  const gpr = grades.map((_, i) => (i === 0 ? 1 : isHS ? 0.975 : i >= 6 ? 0.94 : 0.975));
  const weights: number[] = [];
  grades.forEach((_, i) => weights.push(i === 0 ? 1 : weights[i - 1] * gpr[i]));
  const wSum = weights.reduce((a, b) => a + b, 0);

  const drift = clamp(rng.normal(-0.006, 0.022), -0.05, 0.035);
  let prev: number[] = weights.map((w) => (total0 / wSum) * w * (1 + rng.normal(0, 0.05)));
  let entry = prev[0];
  const tMap = new Map<number, number>();
  const eMap = new Map<number, number>();

  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    let counts: number[];
    if (year === FIRST_YEAR) counts = prev;
    else {
      let shock = drift + rng.normal(0, 0.04);
      if (year === 2020) shock += rng.normal(-0.08, 0.04); // pandemic year dip
      if (year === 2021) shock += 0.03;
      entry = entry * (1 + shock);
      counts = grades.map((_, i) => (i === 0 ? entry : prev[i - 1] * clamp(rng.normal(gpr[i], 0.03), 0.8, 1.08)));
    }
    counts = counts.map((c) => Math.max(5, Math.round(c)));
    counts.forEach((c, i) =>
      enrollment.push({ school_id: s.id, year, grade: grades[i], count: c, provenance: "SAMPLE", source: SOURCE, size_band: bandName })
    );
    tMap.set(year, counts.reduce((a, b) => a + b, 0));
    eMap.set(year, counts[0]);
    prev = counts;
  }
  totals.set(s.id, tMap);
  entryByYear.set(s.id, eMap);
}

// ---------------------------------------------------------------- tuition
interface TuitionOut { school_id: string; year: number; tuition: number; provenance: string; source_url: string }
const tuition: TuitionOut[] = [];
const tuitionOf = new Map<string, Map<number, number>>();
for (const s of schools) {
  const rng = rngFor(s.id, "tuition");
  const isHS = s.isHS;
  let t = isHS ? rng.range(16000, 22000) : rng.range(9000, 15000);
  const m = new Map<number, number>();
  for (let year = FIRST_YEAR; year <= LAST_YEAR; year++) {
    if (year > FIRST_YEAR) t *= 1 + rng.range(0.03, 0.065);
    const v = round(t, 50);
    m.set(year, v);
    tuition.push({ school_id: s.id, year, tuition: v, provenance: "SAMPLE", source_url: "" });
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
const discountOf = new Map<string, number>();
const structuralOf = new Map<string, number>();
for (const s of schools) {
  const rng = rngFor(s.id, "budget");
  const isElem = s.governance === "parish_elementary";
  const discount = rng.range(0.06, 0.16);
  const fundraisingPct = rng.range(0.05, 0.12);
  const subsidyPct = isElem ? rng.range(0, 0.08) : 0;
  const structural = rng.normal(0, 0.04); // >0 = expenses run above revenue
  discountOf.set(s.id, discount);
  structuralOf.set(s.id, structural);
  const reserveDays = clamp(rng.normal(70 - structural * 600, 30), 8, 180); // weaker schools hold less cash
  for (let fy = 2023; fy <= CURRENT_FY; fy++) {
    const schoolYear = fy - 1;
    const enr = totals.get(s.id)!.get(schoolYear)!;
    const tuitionRev = enr * tuitionOf.get(s.id)!.get(schoolYear)! * (1 - discount);
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
        school_id: s.id, as_of: iso(new Date(Date.UTC(2026, 8, 30))),
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
  for (let year = 2022; year <= LAST_YEAR; year++) {
    const enr = totals.get(s.id)!.get(year)!;
    const applications = Math.round(enr * need * (1 + rng.normal(0, 0.06)));
    const awards = Math.round(applications * rng.range(0.7, 0.92));
    const avg = tuitionOf.get(s.id)!.get(year)! * rng.range(0.15, 0.35);
    ta.push({ school_id: s.id, year, applications, awards, total_awarded: round(awards * avg, 100), provenance: "SAMPLE" });
  }
}

// ---------------------------------------------------------------- prospective-family pipeline (monthly)
// Admissions cycle weights by calendar month (Jan..Dec)
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
    const apps = Math.round(inqYear * conv.app * norm(W_APP)[cal] * k);
    const acc = Math.round(inqYear * conv.app * conv.acc * norm(W_ACC)[cal] * k);
    pipeline.push({
      school_id: s.id, month: iso(d).slice(0, 7), inquiries, tours: Math.round(inquiries * conv.tour),
      applications: apps, accepted: acc,
      enrolled: Math.round(inqYear * conv.app * conv.acc * conv.yield * norm(W_ENR)[cal] * k),
      provenance: "SAMPLE",
    });
  }
}

// ---------------------------------------------------------------- facilities
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
  const scale = s.isHS ? 2.2 : 1;
  const chosen = rng.shuffle(ASSETS).slice(0, rng.int(7, 11));
  chosen.forEach((a, i) => {
    const condition = clamp(Math.round(rng.normal(3.4, 1.0)), 1, 5);
    const interval = rng.pick([12, 12, 24, 36]);
    const last = new Date(AS_OF.getTime() - rng.int(20, 560) * 86400000);
    const planYear =
      condition === 1 ? 2027 : condition === 2 ? rng.int(2027, 2028) : condition === 3 ? rng.int(2029, 2031) : rng.int(2032, 2036);
    const priority = condition <= 2 ? "High" : condition === 3 ? (rng.float() < 0.3 ? "High" : "Medium") : "Low";
    facilities.push({
      school_id: s.id, asset_id: `${s.id}-A${String(i + 1).padStart(2, "0")}`, asset: a.asset, category: a.category,
      condition, last_inspection: iso(last), inspection_interval_months: interval,
      est_replacement_cost: round(rng.range(a.cost[0], a.cost[1]) * scale, 1000), priority, capital_plan_year: planYear,
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
  const enr = totals.get(s.id)!.get(LAST_YEAR)!;
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
// Families re-enrolling for school year Y are counted each spring (as of ~Mar 15 of Y).
// Eligible = last year's students minus the top grade. Kept consistent with the enrollment
// file: a school whose cohorts shrink also re-enrolls fewer families.
interface ReOut { school_id: string; year: number; eligible: number; reenrolled: number; provenance: string }
const reenrollment: ReOut[] = [];
for (const s of schools) {
  const rng = rngFor(s.id, "reenroll");
  const rows = enrollment.filter((r) => r.school_id === s.id);
  const top = s.isHS ? "12" : "8";
  const entryGrade = s.isHS ? "9" : "K";
  for (let year = 2022; year <= LAST_YEAR; year++) {
    const prev = rows.filter((r) => r.year === year - 1);
    const cur = rows.filter((r) => r.year === year);
    const eligible = prev.filter((r) => r.grade !== top).reduce((a, r) => a + r.count, 0);
    const continuing = cur.filter((r) => r.grade !== entryGrade).reduce((a, r) => a + r.count, 0);
    const rate = clamp((continuing / eligible) * rng.range(0.9, 0.97), 0.7, 0.99);
    reenrollment.push({ school_id: s.id, year, eligible, reenrolled: Math.round(eligible * rate), provenance: "SAMPLE" });
  }
}

// ---------------------------------------------------------------- turnaround program (roster + actions)
// The roster is a SAMPLE decision: the five weakest parish schools on a simple screen
// (5-year enrollment change + budget structure). lib/health.ts computes the live Matrix;
// the Turnaround page shows both, including schools the Matrix flags that are not enrolled.
const screen = schools
  .filter((s) => s.governance === "parish_elementary")
  .map((s) => {
    const t = totals.get(s.id)!;
    const ch5 = (t.get(LAST_YEAR)! - t.get(LAST_YEAR - 5)!) / t.get(LAST_YEAR - 5)!;
    return { id: s.id, score: ch5 - structuralOf.get(s.id)! * 2 };
  })
  .sort((a, b) => a.score - b.score)
  .slice(0, 5);
const PHASES = ["Assess", "Plan", "Implement", "Implement", "Monitor"] as const;
const ACTIONS: { area: string; action: string; owner: string; metric: string }[] = [
  { area: "Enrollment", action: "Personal re-enrollment conversations with every returning family before the deposit deadline", owner: "Principal", metric: "Re-enrollment rate" },
  { area: "Enrollment", action: "TK/pre-K feeder outreach with parish ministries and local preschools", owner: "Director of Enrollment", metric: "K applications" },
  { area: "Marketing", action: "Inquiry follow-up within 48 hours; log every inquiry in the shared pipeline", owner: "Director of Enrollment", metric: "Inquiry-to-tour rate" },
  { area: "Finance", action: "Bring tuition-assistance discount rate inside the diocesan guideline band", owner: "Business Manager", metric: "Discount rate" },
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
    next_checkin: iso(new Date(AS_OF.getTime() + rng.int(5, 40) * 86400000)), provenance: "SAMPLE",
  });
  if (phase === "Assess") return; // no action plan yet
  rng.shuffle(ACTIONS).slice(0, rng.int(4, 6)).forEach((a, j) => {
    const due = new Date(AS_OF.getTime() + rng.int(-60, 200) * 86400000);
    const overdue = due < AS_OF;
    const status = phase === "Plan" ? "Not started"
      : overdue ? rng.pick(["Done", "Done", "At risk"]) : rng.pick(["On track", "On track", "At risk", "Not started"]);
    turnaroundActions.push({
      school_id: x.id, action_id: `${x.id}-T${j + 1}`, area: a.area, action: a.action, owner_role: a.owner,
      due: iso(due), status, metric: a.metric, provenance: "SAMPLE",
    });
  });
});

// ---------------------------------------------------------------- demographics by ZIP
interface DemoOut { zip: string; year: number; pop_5_14: number; median_household_income: number; provenance: string; source: string }
const demographics: DemoOut[] = [];
for (const zip of [...new Set(schools.map((s) => s.zip))].sort()) {
  const rng = new Rng(SEED ^ hashString(`zip:${zip}`));
  let pop = rng.range(2500, 9000);
  let inc = rng.range(85000, 210000);
  const popTrend = rng.normal(-0.015, 0.012);
  for (let year = 2014; year <= 2023; year++) {
    if (year > 2014) {
      pop *= 1 + popTrend + rng.normal(0, 0.008);
      inc *= 1 + rng.range(0.02, 0.06);
    }
    demographics.push({ zip, year, pop_5_14: Math.round(pop), median_household_income: round(inc, 100), provenance: "SAMPLE", source: SOURCE });
  }
}

// ---------------------------------------------------------------- write
out("enrollment.csv", toCsv(enrollment, ["school_id", "year", "grade", "count", "provenance", "source", "size_band"]));
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
out("demographics.csv", toCsv(demographics, ["zip", "year", "pop_5_14", "median_household_income", "provenance", "source"]));

console.log(
  [
    `enrollment ${enrollment.length}`, `tuition ${tuition.length}`, `budget_actual ${budget.length}`,
    `tuition_assistance ${ta.length}`, `pipeline ${pipeline.length}`, `facilities ${facilities.length}`,
    `data_audit ${audit.length}`, `demographics ${demographics.length}`, `reenrollment ${reenrollment.length}`,
    `cash ${cash.length}`, `receivables ${receivables.length}`, `turnaround ${turnaround.length}/${turnaroundActions.length}`,
  ].join(" | ")
);
