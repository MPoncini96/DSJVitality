/**
 * System-wide views. The real view (the 25 parish schools) and the demo view (25
 * fictional schools carrying all simulated data) are built separately and never mixed.
 */
import { getSchools, getTurnaround, getTurnaroundActions, provenanceOf } from "./data";
import { healthOf, type Health } from "./health";
import { schoolMetrics, type SchoolMetrics } from "./metrics";
import { alertsFor, SEVERITY_ORDER, type Alert } from "./radar";
import type { School, TurnaroundAction, TurnaroundRow } from "./types";

export interface SchoolView {
  school: School;
  metrics: SchoolMetrics;
  health: Health;
  alerts: Alert[];
  turnaround: TurnaroundRow | null;
  actions: TurnaroundAction[];
}

function build(schools: School[]): SchoolView[] {
  const roster = new Map(getTurnaround().map((t) => [t.schoolId, t]));
  const actions = getTurnaroundActions();
  return schools.map((school) => {
    const metrics = schoolMetrics(school.id);
    return {
      school,
      metrics,
      health: healthOf(metrics),
      alerts: alertsFor(metrics),
      turnaround: roster.get(school.id) ?? null,
      actions: actions.filter((a) => a.schoolId === school.id),
    };
  });
}

/** The 25 real parish elementary schools: public data only. */
export const realView = () => build(getSchools("default"));

/** The 25 fictional demo schools: everything simulated. */
export const demoView = () => build(getSchools("demo"));

/**
 * Schools with a critical or serious item, worst first: by severity, then by the size
 * of the long enrollment decline.
 */
export function rankUrgent(views: SchoolView[]): SchoolView[] {
  const worst = (v: SchoolView) => Math.min(3, ...v.alerts.map((a) => SEVERITY_ORDER[a.severity]));
  return views
    .filter((v) => worst(v) <= SEVERITY_ORDER.serious)
    .sort((a, b) => worst(a) - worst(b) || (a.metrics.enrollment.cagr ?? 0) - (b.metrics.enrollment.cagr ?? 0));
}

export function alertsProvenance(views: SchoolView[]) {
  return provenanceOf(views.flatMap((v) => v.alerts).map((a) => ({ provenance: a.provenance === "REAL" ? "REAL" as const : "SAMPLE" as const })));
}
