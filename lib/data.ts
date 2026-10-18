/**
 * The single typed data-access layer. Every page reads data through here, so
 * moving from CSV files to Postgres later means rewriting this file only.
 *
 * Swap mechanism (SAMPLE -> REAL):
 *   data/sample/<name>.csv   generated SAMPLE rows (scripts/generate_sample.ts)
 *   data/<name>.csv          REAL rows (from scripts that pull public sources)
 * Both are loaded; a REAL row replaces the SAMPLE row with the same key. So REAL
 * data can arrive one school (or one year) at a time and the badges follow.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv } from "./csv";
import { Rng } from "./rng";
import type {
  BudgetCategory, BudgetRow, CashRow, DataAuditRow, DemographicsRow, EnrollmentRow, FacilityRow, Feed,
  Governance, PipelineRow, Provenance, ReceivableRow, ReenrollmentRow, School, TuitionAssistanceRow, TuitionRow,
  StaffingRow, TurnaroundAction, TurnaroundPhase, TurnaroundRow,
} from "./types";

const dataDir = () => process.env.VITALITY_DATA_DIR ?? join(process.cwd(), "data");

type Raw = Record<string, string>;
const cache = new Map<string, unknown>();

function readCsv(path: string): Raw[] {
  return existsSync(path) ? parseCsv(readFileSync(path, "utf8")) : [];
}

function asProvenance(v: string, file: string): Provenance {
  if (v === "REAL" || v === "SAMPLE") return v;
  throw new Error(`${file}: provenance must be REAL or SAMPLE, got "${v}"`);
}

const num = (v: string) => (v === "" || v === undefined ? NaN : Number(v));

/** Load SAMPLE + REAL rows for a dataset; REAL wins on key collisions. */
function loadMerged<T extends { provenance: Provenance }>(
  name: string,
  map: (r: Raw, file: string) => T,
  key: (row: T) => string,
  /**
   * Optional grouping (e.g. by school). When a group has ANY REAL rows, all SAMPLE
   * rows in that group are dropped, so a REAL series is never stitched onto
   * simulated history.
   */
  group?: (row: T) => string
): T[] {
  const memo = `${dataDir()}::${name}`;
  if (cache.has(memo)) return cache.get(memo) as T[];
  const samplePath = join(dataDir(), "sample", `${name}.csv`);
  const realPath = join(dataDir(), `${name}.csv`);
  const merged = new Map<string, T>();
  for (const r of readCsv(samplePath)) {
    const row = map(r, samplePath);
    if (row.provenance !== "SAMPLE") throw new Error(`${samplePath}: only SAMPLE rows belong in data/sample/`);
    merged.set(key(row), row);
  }
  for (const r of readCsv(realPath)) {
    const row = map(r, realPath);
    if (row.provenance !== "REAL") throw new Error(`${realPath}: only REAL rows belong outside data/sample/`);
    merged.set(key(row), row);
  }
  let rows = [...merged.values()];
  if (group) {
    const realGroups = new Set(rows.filter((r) => r.provenance === "REAL").map(group));
    rows = rows.filter((r) => r.provenance === "REAL" || !realGroups.has(group(r)));
  }
  cache.set(memo, rows);
  return rows;
}

/** Test helper: forget cached files. */
export function clearCache() {
  cache.clear();
}

// ---------------------------------------------------------------- schools
export type SchoolScope = "default" | "all";

export function getSchools(scope: SchoolScope = "default"): School[] {
  const memo = `${dataDir()}::schools`;
  let all = cache.get(memo) as School[] | undefined;
  if (!all) {
    all = readCsv(join(dataDir(), "schools.csv")).map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      city: r.city,
      zip: r.zip,
      zipSource: r.zip_source === "geocoder" ? "geocoder" : "source",
      phone: r.phone,
      website: r.website,
      grades: r.grades,
      parish: r.parish,
      governance: r.governance as Governance,
      governanceBasis: r.governance_basis,
      lat: num(r.lat),
      lng: num(r.lng),
      geocodeMatch: r.geocode_match,
      geocodeNote: r.geocode_note,
      sourceUrl: r.source_url,
      retrieved: r.retrieved,
    }));
    cache.set(memo, all);
  }
  return scope === "all" ? all : all.filter((s) => s.governance === "parish_elementary");
}

export function getSchool(id: string): School | undefined {
  return getSchools("all").find((s) => s.id === id);
}

// ---------------------------------------------------------------- datasets
export const getEnrollment = () =>
  loadMerged<EnrollmentRow>(
    "enrollment",
    (r, f) => ({ schoolId: r.school_id, year: num(r.year), grade: r.grade, count: num(r.count), provenance: asProvenance(r.provenance, f), source: r.source }),
    (x) => `${x.schoolId}|${x.year}|${x.grade}`,
    (x) => x.schoolId
  );

/** Staffing from the CDE affidavit (REAL only; no SAMPLE equivalent). */
export const getStaffing = () =>
  loadMerged<StaffingRow>(
    "staffing",
    (r, f) => ({
      schoolId: r.school_id, year: num(r.year), ftTeachers: num(r.ft_teachers), ptTeachers: num(r.pt_teachers),
      admins: num(r.admins), otherStaff: num(r.other_staff), provenance: asProvenance(r.provenance, f), source: r.source,
    }),
    (x) => `${x.schoolId}|${x.year}`
  );

export const getTuition = () =>
  loadMerged<TuitionRow>(
    "tuition",
    (r, f) => ({ schoolId: r.school_id, year: num(r.year), tuition: r.tuition === "" ? null : num(r.tuition), provenance: asProvenance(r.provenance, f), sourceUrl: r.source_url }),
    (x) => `${x.schoolId}|${x.year}`
  );

export const getBudget = () =>
  loadMerged<BudgetRow>(
    "budget_actual",
    (r, f) => ({
      schoolId: r.school_id, fiscalYear: num(r.fiscal_year), fiscalMonth: num(r.fiscal_month), category: r.category as BudgetCategory,
      kind: r.kind as "revenue" | "expense", budget: num(r.budget), actual: r.actual === "" ? null : num(r.actual), provenance: asProvenance(r.provenance, f),
    }),
    (x) => `${x.schoolId}|${x.fiscalYear}|${x.fiscalMonth}|${x.category}`
  );

export const getTuitionAssistance = () =>
  loadMerged<TuitionAssistanceRow>(
    "tuition_assistance",
    (r, f) => ({ schoolId: r.school_id, year: num(r.year), applications: num(r.applications), awards: num(r.awards), totalAwarded: num(r.total_awarded), provenance: asProvenance(r.provenance, f) }),
    (x) => `${x.schoolId}|${x.year}`
  );

export const getPipeline = () =>
  loadMerged<PipelineRow>(
    "pipeline",
    (r, f) => ({
      schoolId: r.school_id, month: r.month, inquiries: num(r.inquiries), tours: num(r.tours), applications: num(r.applications),
      accepted: num(r.accepted), enrolled: num(r.enrolled), provenance: asProvenance(r.provenance, f),
    }),
    (x) => `${x.schoolId}|${x.month}`
  );

export const getFacilities = () =>
  loadMerged<FacilityRow>(
    "facilities",
    (r, f) => ({
      schoolId: r.school_id, assetId: r.asset_id, asset: r.asset, category: r.category, condition: num(r.condition),
      lastInspection: r.last_inspection, inspectionIntervalMonths: num(r.inspection_interval_months),
      estReplacementCost: num(r.est_replacement_cost), priority: r.priority as FacilityRow["priority"],
      capitalPlanYear: num(r.capital_plan_year), provenance: asProvenance(r.provenance, f),
    }),
    (x) => x.assetId
  );

export const getDataAudit = () =>
  loadMerged<DataAuditRow>(
    "data_audit",
    (r, f) => ({
      schoolId: r.school_id, feed: r.feed as Feed, lastRefresh: r.last_refresh, rowCount: num(r.row_count),
      completenessPct: num(r.completeness_pct), issues: num(r.issues), provenance: asProvenance(r.provenance, f),
    }),
    (x) => `${x.schoolId}|${x.feed}`
  );

export const getDemographics = () =>
  loadMerged<DemographicsRow>(
    "demographics",
    (r, f) => ({ zip: r.zip, year: num(r.year), pop5to14: num(r.pop_5_14), medianHouseholdIncome: num(r.median_household_income), provenance: asProvenance(r.provenance, f), source: r.source }),
    (x) => `${x.zip}|${x.year}`
  );

export const getReenrollment = () =>
  loadMerged<ReenrollmentRow>(
    "reenrollment",
    (r, f) => ({ schoolId: r.school_id, year: num(r.year), eligible: num(r.eligible), reenrolled: num(r.reenrolled), provenance: asProvenance(r.provenance, f) }),
    (x) => `${x.schoolId}|${x.year}`
  );

export const getCash = () =>
  loadMerged<CashRow>(
    "cash_monthly",
    (r, f) => ({ schoolId: r.school_id, month: r.month, cash: num(r.cash), provenance: asProvenance(r.provenance, f) }),
    (x) => `${x.schoolId}|${x.month}`
  );

export const getReceivables = () =>
  loadMerged<ReceivableRow>(
    "receivables",
    (r, f) => ({
      schoolId: r.school_id, asOf: r.as_of, current: num(r.current), days30: num(r.days_30), days60: num(r.days_60),
      days90Plus: num(r.days_90_plus), annualTuitionBilled: num(r.annual_tuition_billed), provenance: asProvenance(r.provenance, f),
    }),
    (x) => `${x.schoolId}|${x.asOf}`
  );

export const getTurnaround = () =>
  loadMerged<TurnaroundRow>(
    "turnaround",
    (r, f) => ({ schoolId: r.school_id, entered: r.entered, phase: r.phase as TurnaroundPhase, lead: r.lead, nextCheckin: r.next_checkin, provenance: asProvenance(r.provenance, f) }),
    (x) => x.schoolId
  );

export const getTurnaroundActions = () =>
  loadMerged<TurnaroundAction>(
    "turnaround_actions",
    (r, f) => ({
      schoolId: r.school_id, actionId: r.action_id, area: r.area, action: r.action, ownerRole: r.owner_role, due: r.due,
      status: r.status as TurnaroundAction["status"], metric: r.metric, provenance: asProvenance(r.provenance, f),
    }),
    (x) => x.actionId
  );

// ---------------------------------------------------------------- derived helpers
export type MixedProvenance = Provenance | "MIXED";

/** Provenance of a set of rows: REAL only if every row is REAL. */
export function provenanceOf(rows: { provenance: Provenance }[]): MixedProvenance {
  if (rows.length === 0) return "SAMPLE";
  const hasReal = rows.some((r) => r.provenance === "REAL");
  const hasSample = rows.some((r) => r.provenance === "SAMPLE");
  return hasReal && hasSample ? "MIXED" : hasReal ? "REAL" : "SAMPLE";
}

export interface SchoolYearTotal {
  schoolId: string;
  year: number;
  total: number;
  provenance: MixedProvenance;
}

/** Total enrollment per school per year. */
export function enrollmentTotals(schoolIds?: string[]): SchoolYearTotal[] {
  const filter = schoolIds ? new Set(schoolIds) : null;
  const groups = new Map<string, EnrollmentRow[]>();
  for (const r of getEnrollment()) {
    if (filter && !filter.has(r.schoolId)) continue;
    const k = `${r.schoolId}|${r.year}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  return [...groups.values()]
    .map((rows) => ({
      schoolId: rows[0].schoolId,
      year: rows[0].year,
      total: rows.reduce((a, r) => a + r.count, 0),
      provenance: provenanceOf(rows),
    }))
    .sort((a, b) => a.schoolId.localeCompare(b.schoolId) || a.year - b.year);
}

/** System-wide enrollment by year for the given schools. */
export function systemTrend(
  schoolIds: string[]
): { year: number; total: number; provenance: MixedProvenance; carriedForward: string[] }[] {
  const byYear = new Map<number, SchoolYearTotal[]>();
  const totals = enrollmentTotals(schoolIds);
  for (const t of totals) (byYear.get(t.year) ?? byYear.set(t.year, []).get(t.year)!).push(t);
  // Only years in which every school with data reports; otherwise the total jumps when a
  // school's series starts or ends. A school missing a single interior year (a gap in the
  // source) is carried at its prior year's value, and the year reports how many values
  // were carried forward (`imputed`) so the chart can say so.
  const reporting = new Set(totals.map((t) => t.schoolId));
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const firstOf = new Map<string, number>(), lastOf = new Map<string, number>();
  for (const t of totals) {
    firstOf.set(t.schoolId, Math.min(firstOf.get(t.schoolId) ?? Infinity, t.year));
    lastOf.set(t.schoolId, Math.max(lastOf.get(t.schoolId) ?? -Infinity, t.year));
  }
  const lo = Math.max(...firstOf.values()), hi = Math.min(...lastOf.values());
  const imputed = new Map<number, string[]>();
  for (const y of years) {
    if (y < lo || y > hi) { byYear.delete(y); continue; }
    const present = new Set(byYear.get(y)!.map((t) => t.schoolId));
    for (const id of reporting) {
      if (present.has(id)) continue;
      const prior = totals.filter((t) => t.schoolId === id && t.year < y).sort((a, b) => b.year - a.year)[0];
      if (prior) {
        byYear.get(y)!.push({ ...prior, year: y });
        imputed.set(y, [...(imputed.get(y) ?? []), id]);
      }
    }
  }
  return [...byYear.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([year, ts]) => {
      const provs = new Set(ts.map((t) => t.provenance));
      const provenance: MixedProvenance = provs.size === 1 ? [...provs][0] : "MIXED";
      return { year, total: ts.reduce((a, t) => a + t.total, 0), provenance, carriedForward: imputed.get(year) ?? [] };
    });
}

/** Number of consecutive year-over-year declines ending at the latest year. */
export function consecutiveDeclines(series: { year: number; total: number }[]): number {
  const s = [...series].sort((a, b) => a.year - b.year);
  let n = 0;
  for (let i = s.length - 1; i > 0 && s[i].total < s[i - 1].total; i--) n++;
  return n;
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

/**
 * Stable anonymous labels ("School A", "School B", ...). The order is a seeded
 * shuffle, not alphabetical, so letters can't be mapped back to names. Parish
 * elementary schools come first (A..Y), so the default view uses contiguous letters
 * and a school keeps the same letter in every view.
 */
export function anonymousLabels(schools: School[]): Record<string, string> {
  const byId = [...schools].sort((a, b) => a.id.localeCompare(b.id));
  const rng = new Rng(7177);
  const order = [
    ...rng.shuffle(byId.filter((s) => s.governance === "parish_elementary")),
    ...rng.shuffle(byId.filter((s) => s.governance !== "parish_elementary")),
  ];
  const label = (i: number) =>
    i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
  return Object.fromEntries(order.map((s, i) => [s.id, `School ${label(i)}`]));
}

/** Latest school year present in the enrollment data. */
export function latestEnrollmentYear(): number {
  return Math.max(...getEnrollment().map((r) => r.year));
}

export const schoolYearLabel = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;

export const GOVERNANCE_LABEL: Record<Governance, string> = {
  parish_elementary: "Parish elementary",
  diocesan_high: "Diocesan high school",
  order_or_independent: "Order-run / independent",
};
