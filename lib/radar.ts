/**
 * Radar: exception rules that turn metrics into a short list of things that need
 * the director's attention. Each rule is written out so it can be debated and tuned.
 */
import type { MixedProvenance } from "./data";
import type { SchoolMetrics } from "./metrics";

export type Severity = "critical" | "serious" | "warning";
export type Area = "Enrollment" | "Finance" | "Facilities" | "Systems";

export interface Alert {
  schoolId: string;
  area: Area;
  severity: Severity;
  title: string;
  detail: string;
  provenance: MixedProvenance;
}

export const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, serious: 1, warning: 2 };

const pct = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(1)}%`;
const money = (v: number) => `$${Math.round(v).toLocaleString()}`;

export interface Rule {
  area: Area;
  description: string;
  check: (m: SchoolMetrics) => Omit<Alert, "schoolId" | "area"> | null;
}

export const RULES: Rule[] = [
  {
    area: "Enrollment",
    description: "Fall enrollment down 5% or more vs. last year (8%+ is critical)",
    check: (m) => {
      const c = m.enrollment.change1;
      if (c === null || c > -0.05) return null;
      return { severity: c <= -0.08 ? "critical" : "serious", title: `Enrollment ${pct(c)} vs. last fall`, detail: `${m.enrollment.latest} students this fall.`, provenance: m.enrollment.provenance };
    },
  },
  {
    area: "Enrollment",
    description: "Three or more consecutive years of decline (five or more is critical)",
    check: (m) => {
      const n = m.enrollment.consecutiveDeclines;
      if (n < 3) return null;
      return { severity: n >= 5 ? "critical" : "serious", title: `${n} straight years of decline`, detail: `5-year trend ${m.enrollment.cagr5 === null ? "n/a" : pct(m.enrollment.cagr5)} per year.`, provenance: m.enrollment.provenance };
    },
  },
  {
    area: "Enrollment",
    description: "Any grade under 15 students (single-classroom viability)",
    check: (m) => {
      const t = m.enrollment.thinGrades;
      if (!t.length) return null;
      return { severity: t.some((g) => g.count < 12) ? "serious" : "warning", title: `${t.length} grade${t.length > 1 ? "s" : ""} under 15 students`, detail: t.map((g) => `Grade ${g.grade}: ${g.count}`).join(", "), provenance: m.enrollment.provenance };
    },
  },
  {
    area: "Enrollment",
    description: "Re-enrollment rate under 88% (under 85% is serious)",
    check: (m) => {
      const r = m.reenrollment.rate;
      if (r === null || r >= 0.88) return null;
      return { severity: r < 0.85 ? "serious" : "warning", title: `Re-enrollment ${(r * 100).toFixed(0)}%`, detail: m.reenrollment.priorRate === null ? "" : `Prior year ${(m.reenrollment.priorRate * 100).toFixed(0)}%.`, provenance: m.reenrollment.provenance };
    },
  },
  {
    area: "Enrollment",
    description: "New-family inquiries 10%+ behind the same point last cycle (20%+ is serious)",
    check: (m) => {
      const p = m.pipeline.inquiryPacing;
      if (p === null || p > -0.1) return null;
      return { severity: p <= -0.2 ? "serious" : "warning", title: `Inquiries ${pct(p)} vs. last cycle`, detail: `${m.pipeline.inquiriesYtd} vs. ${m.pipeline.inquiriesPriorYtd} at the same point.`, provenance: m.pipeline.provenance };
    },
  },
  {
    area: "Enrollment",
    description: "Projected enrollment down 10%+ by the last projected year (20%+ is serious); from real births and grade data, skipped when the projection is low-confidence",
    check: (m) => {
      const p = m.projection;
      if (p.change === null || p.change > -0.1 || p.lowConfidence.length) return null;
      const last = p.years.at(-1)!;
      return {
        severity: p.change <= -0.2 ? "serious" : "warning",
        title: `Projected ${pct(p.change)} by ${last.year}-${String((last.year + 1) % 100).padStart(2, "0")}`,
        detail: `${last.total} students projected, ${last.k} in kindergarten.`,
        provenance: p.inputs,
      };
    },
  },
  {
    area: "Finance",
    description: "Operating deficit in the last closed fiscal year (worse than -4% is critical)",
    check: (m) => {
      const v = m.finance.operatingMargin;
      if (v === null || v >= 0) return null;
      return { severity: v < -0.04 ? "critical" : "warning", title: `Operating margin ${pct(v)} (FY${m.finance.closedFy})`, detail: m.finance.revenue && m.finance.expense ? `Deficit of ${money(m.finance.expense - m.finance.revenue)}.` : "", provenance: m.finance.provenance };
    },
  },
  {
    area: "Finance",
    description: "Under 45 days of cash on hand (under 20 is critical)",
    check: (m) => {
      const d = m.finance.daysCash;
      if (d === null || d >= 45) return null;
      return { severity: d < 20 ? "critical" : "serious", title: `${Math.round(d)} days of cash on hand`, detail: "Latest month-end balance vs. average daily expense.", provenance: m.finance.provenance };
    },
  },
  {
    area: "Finance",
    description: "Expenses running 2.5%+ ahead of budget year to date (5%+ is serious)",
    check: (m) => {
      const v = m.finance.expenseVarianceYtd;
      if (v === null || v < 0.025) return null;
      return { severity: v >= 0.05 ? "serious" : "warning", title: `Expenses ${pct(v)} vs. budget YTD`, detail: `FY${m.finance.currentFy}, ${m.finance.monthsClosed} month${m.finance.monthsClosed === 1 ? "" : "s"} closed.`, provenance: m.finance.provenance };
    },
  },
  {
    area: "Finance",
    description: "Tuition 60+ days past due above 3% of annual billing",
    check: (m) => {
      const v = m.finance.receivables60PlusPct;
      if (v === null || v < 0.03) return null;
      const over = m.finance.receivablesAging.filter((b) => b.bucket === "60 days" || b.bucket === "90+ days").reduce((a, b) => a + b.amount, 0);
      return { severity: "serious", title: `${(v * 100).toFixed(1)}% of tuition 60+ days late`, detail: `${money(over)} outstanding.`, provenance: m.finance.provenance };
    },
  },
  {
    area: "Finance",
    description: "Tuition assistance above 22% of gross tuition",
    check: (m) => {
      const v = m.finance.taDependency;
      if (v === null || v < 0.22) return null;
      return { severity: "warning", title: `Assistance ${(v * 100).toFixed(0)}% of gross tuition`, detail: "Above the illustrative guideline band.", provenance: m.finance.provenance };
    },
  },
  {
    area: "Facilities",
    description: "Any life-safety asset rated 1-2 (two or more is critical)",
    check: (m) => {
      const l = m.facilities.lifeSafetyOpen;
      if (!l.length) return null;
      return { severity: l.length >= 2 ? "critical" : "serious", title: `${l.length} life-safety item${l.length > 1 ? "s" : ""} in poor condition`, detail: l.map((a) => `${a.asset} (${a.condition}/5)`).join(", "), provenance: m.facilities.provenance };
    },
  },
  {
    area: "Facilities",
    description: "Facility condition index above 30%",
    check: (m) => {
      const v = m.facilities.fci;
      if (v === null || v <= 0.3) return null;
      return { severity: "serious", title: `Facility condition index ${(v * 100).toFixed(0)}%`, detail: `${money(m.facilities.deferredCost)} in poor-condition assets.`, provenance: m.facilities.provenance };
    },
  },
  {
    area: "Facilities",
    description: "Three or more inspections overdue",
    check: (m) => {
      const n = m.facilities.overdueInspections;
      if (n < 3) return null;
      return { severity: "warning", title: `${n} inspections overdue`, detail: "", provenance: m.facilities.provenance };
    },
  },
  {
    area: "Systems",
    description: "A data feed not refreshed in 30+ days, or under 80% complete",
    check: (m) => {
      const low = m.systems.feeds.filter((f) => f.completenessPct < 80).map((f) => f.feed);
      const s = [...new Set([...m.systems.staleFeeds, ...low])];
      if (!s.length) return null;
      const parts = [
        m.systems.staleFeeds.length ? `stale: ${m.systems.staleFeeds.join(", ")}` : "",
        low.length ? `incomplete: ${low.join(", ")}` : "",
      ].filter(Boolean);
      return { severity: "warning", title: `Data issue in ${s.join(", ")}`, detail: parts.join("; "), provenance: m.systems.provenance };
    },
  },
];

export function alertsFor(m: SchoolMetrics): Alert[] {
  return RULES.flatMap((r) => {
    const a = r.check(m);
    return a ? [{ ...a, schoolId: m.schoolId, area: r.area }] : [];
  }).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
