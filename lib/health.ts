/**
 * Health scores, written as a transparent formula.
 *
 * Every factor is turned into a 0-100 sub-score by straight-line interpolation
 * between a "concern" value (scores 0) and a "healthy" value (scores 100), then
 * clamped. A score is the weighted average of its factors. If a factor is missing
 * (e.g. capacity, which is not published), it is skipped and the remaining weights
 * are re-normalized; the result lists what was skipped.
 *
 * Two headline scores, on purpose:
 *
 *   ENROLLMENT VITALITY: built only from inputs that have a public source
 *     (state enrollment by grade, Census population). Once those files are REAL,
 *     this score is REAL and can sit next to a school's name.
 *
 *   COMPOSITE (illustrative): Vitality 50% + Financial 35% + Facilities 15%.
 *     Finance and facilities inputs have no public source, so the composite stays
 *     SAMPLE. Risk labels derived from it are never shown next to real names.
 *
 * Thresholds are starting points for discussion with the Department of Catholic
 * Schools, not policy.
 */
import { provenanceOf, type MixedProvenance } from "./data";
import type { SchoolMetrics } from "./metrics";

export type Tier = "Stable" | "Watch" | "Turnaround candidate";
export type Quadrant = "Stable" | "Watch" | "Growth opportunity" | "Turnaround candidate";

export interface FactorDef {
  key: string;
  label: string;
  weight: number;
  /** value at which the sub-score is 0 */
  concern: number;
  /** value at which the sub-score is 100 */
  healthy: number;
  format: (v: number) => string;
  explain: string;
}

export interface Factor extends FactorDef {
  value: number | null;
  sub: number | null;
  /** share of the final score this factor actually carries after re-normalizing */
  effectiveWeight: number;
  /** points lost vs. a perfect score, used to rank "top contributing factors" */
  drag: number;
  provenance: MixedProvenance;
}

export interface ScoreResult {
  score: number | null;
  tier: Tier | null;
  factors: Factor[];
  skipped: string[];
  provenance: MixedProvenance;
}

const pct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`;
const pctPlain = (v: number) => `${(v * 100).toFixed(1)}%`;
const days = (v: number) => `${Math.round(v)} days`;
const count = (v: number) => String(Math.round(v));

export const VITALITY: FactorDef[] = [
  { key: "cagr5", label: "5-year enrollment trend (CAGR)", weight: 30, concern: -0.05, healthy: 0.02, format: pct, explain: "Compound annual growth over five school years." },
  { key: "change1", label: "1-year enrollment change", weight: 15, concern: -0.06, healthy: 0.03, format: pct, explain: "This fall vs. last fall." },
  { key: "cohortRetention", label: "Cohort retention", weight: 25, concern: 0.88, healthy: 0.98, format: pctPlain, explain: "Students in each grade last year who appear one grade up this year (3-year average). Computable from state grade-level data." },
  { key: "entryTrend3", label: "Entry-grade trend (3 yr)", weight: 15, concern: -0.08, healthy: 0.03, format: pct, explain: "Kindergarten (or 9th grade) intake: it sets enrollment for years to come." },
  { key: "pop5to14Change5", label: "Local school-age population (5 yr)", weight: 15, concern: -0.1, healthy: 0.05, format: pct, explain: "Children aged 5-14 in the school's ZIP code (ACS 5-year)." },
  { key: "capacityUtilization", label: "Capacity utilization", weight: 0, concern: 0.6, healthy: 0.9, format: pctPlain, explain: "Not published for any school; skipped until capacity is known." },
];

export const FINANCIAL: FactorDef[] = [
  { key: "operatingMargin", label: "Operating margin (last closed FY)", weight: 35, concern: -0.06, healthy: 0.04, format: pct, explain: "(Revenue - expense) / revenue, actuals." },
  { key: "daysCash", label: "Days cash on hand", weight: 25, concern: 15, healthy: 90, format: days, explain: "Latest month-end cash / average daily expense." },
  { key: "taDependency", label: "Tuition-assistance dependency", weight: 15, concern: 0.25, healthy: 0.08, format: pctPlain, explain: "Assistance awarded / gross tuition at list price." },
  { key: "expenseVarianceYtd", label: "Expense vs. budget, year to date", weight: 15, concern: 0.08, healthy: 0, format: pct, explain: "Positive = spending ahead of budget." },
  { key: "receivables60PlusPct", label: "Tuition 60+ days past due", weight: 10, concern: 0.04, healthy: 0.005, format: pctPlain, explain: "Share of annual tuition billed." },
];

export const FACILITIES: FactorDef[] = [
  { key: "fci", label: "Facility condition index", weight: 60, concern: 0.35, healthy: 0.05, format: pctPlain, explain: "Replacement cost of assets in poor condition (1-2) / total replacement cost of tracked assets." },
  { key: "lifeSafetyOpen", label: "Open life-safety items", weight: 40, concern: 3, healthy: 0, format: count, explain: "Fire alarm, access control and similar assets rated 1-2." },
];

export const COMPOSITE_WEIGHTS = { vitality: 0.5, financial: 0.35, facilities: 0.15 };
export const TIER_CUTS = { stable: 70, watch: 50 };

export function subScore(value: number, concern: number, healthy: number): number {
  const t = (value - concern) / (healthy - concern);
  return Math.round(Math.min(1, Math.max(0, t)) * 100);
}

export function tierOf(score: number | null): Tier | null {
  if (score === null) return null;
  return score >= TIER_CUTS.stable ? "Stable" : score >= TIER_CUTS.watch ? "Watch" : "Turnaround candidate";
}

function combine(defs: FactorDef[], values: Record<string, { value: number | null; provenance: MixedProvenance }>): ScoreResult {
  const present = defs.filter((d) => d.weight > 0 && values[d.key]?.value !== null && values[d.key]?.value !== undefined);
  const totalW = present.reduce((a, d) => a + d.weight, 0);
  const factors: Factor[] = defs.map((d) => {
    const v = values[d.key]?.value ?? null;
    const sub = v === null || d.weight === 0 ? null : subScore(v, d.concern, d.healthy);
    const eff = sub === null || totalW === 0 ? 0 : d.weight / totalW;
    return { ...d, value: v, sub, effectiveWeight: eff, drag: sub === null ? 0 : eff * (100 - sub), provenance: values[d.key]?.provenance ?? "SAMPLE" };
  });
  const used = factors.filter((f) => f.sub !== null);
  const score = used.length ? Math.round(used.reduce((a, f) => a + f.sub! * f.effectiveWeight, 0)) : null;
  return {
    score,
    tier: tierOf(score),
    factors,
    skipped: factors.filter((f) => f.sub === null).map((f) => f.label),
    provenance: provenanceOf(used.map((f) => ({ provenance: f.provenance === "REAL" ? "REAL" : "SAMPLE" }))),
  };
}

export interface Health {
  vitality: ScoreResult;
  financial: ScoreResult;
  facilities: ScoreResult;
  composite: { score: number | null; tier: Tier | null; provenance: MixedProvenance; topFactors: Factor[] };
  quadrant: Quadrant | null;
}

export function healthOf(m: SchoolMetrics): Health {
  const e = m.enrollment.provenance;
  const vitality = combine(VITALITY, {
    cagr5: { value: m.enrollment.cagr5, provenance: e },
    change1: { value: m.enrollment.change1, provenance: e },
    cohortRetention: { value: m.enrollment.cohortRetention, provenance: e },
    entryTrend3: { value: m.enrollment.entryTrend3, provenance: e },
    pop5to14Change5: { value: m.market.pop5to14Change5, provenance: m.market.provenance },
    capacityUtilization: { value: null, provenance: "SAMPLE" },
  });
  const f = m.finance.provenance;
  const financial = combine(FINANCIAL, {
    operatingMargin: { value: m.finance.operatingMargin, provenance: f },
    daysCash: { value: m.finance.daysCash, provenance: f },
    taDependency: { value: m.finance.taDependency, provenance: f },
    expenseVarianceYtd: { value: m.finance.expenseVarianceYtd, provenance: f },
    receivables60PlusPct: { value: m.finance.receivables60PlusPct, provenance: f },
  });
  const facilities = combine(FACILITIES, {
    fci: { value: m.facilities.fci, provenance: m.facilities.provenance },
    lifeSafetyOpen: { value: m.facilities.lifeSafetyOpen.length, provenance: m.facilities.provenance },
  });

  const parts = [
    { r: vitality, w: COMPOSITE_WEIGHTS.vitality },
    { r: financial, w: COMPOSITE_WEIGHTS.financial },
    { r: facilities, w: COMPOSITE_WEIGHTS.facilities },
  ].filter((p) => p.r.score !== null);
  const wSum = parts.reduce((a, p) => a + p.w, 0);
  const score = parts.length ? Math.round(parts.reduce((a, p) => a + p.r.score! * p.w, 0) / wSum) : null;
  const all = parts.flatMap((p) => p.r.factors.map((x) => ({ ...x, drag: x.drag * (p.w / wSum) })));
  const composite = {
    score,
    tier: tierOf(score),
    provenance: provenanceOf(parts.map((p) => ({ provenance: p.r.provenance === "REAL" ? "REAL" as const : "SAMPLE" as const }))),
    topFactors: all.filter((x) => x.sub !== null).sort((a, b) => b.drag - a.drag).slice(0, 3),
  };

  return { vitality, financial, facilities, composite, quadrant: quadrantOf(m.enrollment.cagr5, financial.score) };
}

/**
 * Enrollment & Finance Matrix.
 *   x = 5-year enrollment CAGR (split at 0%)
 *   y = Financial score (split at 50)
 *   growing + strong  -> Stable
 *   growing + weak    -> Growth opportunity (demand is there; fix the finances)
 *   shrinking + strong-> Watch (cushion today, trend is the risk)
 *   shrinking + weak  -> Turnaround candidate
 */
export const MATRIX_SPLIT = { x: 0, y: 50 };

export function quadrantOf(cagr5: number | null, financial: number | null): Quadrant | null {
  if (cagr5 === null || financial === null) return null;
  const up = cagr5 >= MATRIX_SPLIT.x, strong = financial >= MATRIX_SPLIT.y;
  return up ? (strong ? "Stable" : "Growth opportunity") : strong ? "Watch" : "Turnaround candidate";
}
