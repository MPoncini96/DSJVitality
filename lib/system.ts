/** System-wide view: every school with its metrics, health and alerts. */
import { getSchools, getTurnaround, getTurnaroundActions, provenanceOf, type SchoolScope } from "./data";
import { healthOf, type Health } from "./health";
import { schoolMetrics, type SchoolMetrics } from "./metrics";
import { alertsFor, type Alert } from "./radar";
import type { School, TurnaroundAction, TurnaroundRow } from "./types";

export interface SchoolView {
  school: School;
  metrics: SchoolMetrics;
  health: Health;
  alerts: Alert[];
  turnaround: TurnaroundRow | null;
  actions: TurnaroundAction[];
}

export function systemView(scope: SchoolScope = "default"): SchoolView[] {
  const roster = new Map(getTurnaround().map((t) => [t.schoolId, t]));
  const actions = getTurnaroundActions();
  return getSchools(scope).map((school) => {
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

export function alertsProvenance(views: SchoolView[]) {
  return provenanceOf(views.flatMap((v) => v.alerts).map((a) => ({ provenance: a.provenance === "REAL" ? "REAL" as const : "SAMPLE" as const })));
}
