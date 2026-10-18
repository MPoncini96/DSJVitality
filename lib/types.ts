/**
 * Typed data models for the School Vitality prototype.
 *
 * Every record that carries a metric also carries a `provenance` tag:
 *   - REAL:   taken from a public source, cited in data/SOURCES.md
 *   - SAMPLE: simulated by scripts/generate_sample.ts (fixed seed). Never real.
 * Swapping SAMPLE for REAL data is a data-file change only; the UI reads the tag.
 */

export type Provenance = "REAL" | "SAMPLE";

/** How a school is governed. Used for the default view (parish_elementary). */
export type Governance = "parish_elementary" | "diocesan_high" | "order_or_independent";

export interface School {
  id: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  /** "source" when the ZIP came from the directory, "geocoder" when it was filled from the Census geocoder. */
  zipSource: "source" | "geocoder";
  phone: string;
  website: string;
  /** Blank until filled from a REAL source (e.g. CDE affidavit). */
  grades: string;
  /** Blank: the directory does not list parish affiliation. */
  parish: string;
  governance: Governance;
  /** e.g. "inferred - verify". Governance is NOT published on the source page. */
  governanceBasis: string;
  lat: number;
  lng: number;
  geocodeMatch: string;
  geocodeNote: string;
  sourceUrl: string;
  retrieved: string;
}

/** School years are keyed by their starting calendar year: 2025 = "2025-26". */
export interface EnrollmentRow {
  schoolId: string;
  year: number;
  /** "K", "1".."12" */
  grade: string;
  count: number;
  provenance: Provenance;
  source: string;
}

export interface TuitionRow {
  schoolId: string;
  year: number;
  tuition: number | null;
  provenance: Provenance;
  sourceUrl: string;
}

export type BudgetCategory =
  | "tuition_revenue"
  | "fundraising"
  | "parish_subsidy"
  | "other_revenue"
  | "salaries_benefits"
  | "facilities"
  | "instructional"
  | "administrative";

export interface BudgetRow {
  schoolId: string;
  /** Fiscal year ending June 30, e.g. 2026 = Jul 2025 - Jun 2026 */
  fiscalYear: number;
  /** 1-12 = Jul..Jun */
  fiscalMonth: number;
  category: BudgetCategory;
  kind: "revenue" | "expense";
  budget: number;
  /** null for months that have not closed yet */
  actual: number | null;
  provenance: Provenance;
}

export interface TuitionAssistanceRow {
  schoolId: string;
  year: number;
  applications: number;
  awards: number;
  totalAwarded: number;
  provenance: Provenance;
}

export interface PipelineRow {
  schoolId: string;
  /** YYYY-MM */
  month: string;
  inquiries: number;
  tours: number;
  applications: number;
  accepted: number;
  enrolled: number;
  provenance: Provenance;
}

export interface FacilityRow {
  schoolId: string;
  assetId: string;
  asset: string;
  category: string;
  /** 1 = failing, 5 = excellent */
  condition: number;
  lastInspection: string;
  inspectionIntervalMonths: number;
  estReplacementCost: number;
  priority: "High" | "Medium" | "Low";
  capitalPlanYear: number;
  provenance: Provenance;
}

export type Feed = "TADS" | "Power BI" | "SharePoint" | "Workday" | "QuickBooks";

export interface DataAuditRow {
  schoolId: string;
  feed: Feed;
  lastRefresh: string;
  rowCount: number;
  completenessPct: number;
  issues: number;
  provenance: Provenance;
}

export interface DemographicsRow {
  zip: string;
  /** ACS 5-year end year, e.g. 2023 = 2019-2023 */
  year: number;
  pop5to14: number;
  medianHouseholdIncome: number;
  provenance: Provenance;
  source: string;
}

/** Families re-enrolling for school year `year`, counted in spring. */
export interface ReenrollmentRow {
  schoolId: string;
  year: number;
  eligible: number;
  reenrolled: number;
  provenance: Provenance;
}

export interface CashRow {
  schoolId: string;
  /** YYYY-MM, month-end balance */
  month: string;
  cash: number;
  provenance: Provenance;
}

/** Tuition receivable aging snapshot. */
export interface ReceivableRow {
  schoolId: string;
  asOf: string;
  current: number;
  days30: number;
  days60: number;
  days90Plus: number;
  annualTuitionBilled: number;
  provenance: Provenance;
}

export type TurnaroundPhase = "Assess" | "Plan" | "Implement" | "Monitor";

export interface TurnaroundRow {
  schoolId: string;
  entered: string;
  phase: TurnaroundPhase;
  lead: string;
  nextCheckin: string;
  provenance: Provenance;
}

export interface TurnaroundAction {
  schoolId: string;
  actionId: string;
  area: string;
  action: string;
  ownerRole: string;
  due: string;
  status: "Not started" | "On track" | "At risk" | "Done";
  metric: string;
  provenance: Provenance;
}

/** Staff counts reported on the CDE Private School Affidavit. */
export interface StaffingRow {
  schoolId: string;
  year: number;
  ftTeachers: number;
  ptTeachers: number;
  admins: number;
  otherStaff: number;
  provenance: Provenance;
  source: string;
}
