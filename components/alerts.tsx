import Link from "next/link";
import { RiskSchoolRef } from "./Names";
import { SeverityPill } from "./ui";
import { provenanceOf, type SchoolScope } from "@/lib/data";
import { SEVERITY_ORDER, type Alert, type Area, type Severity } from "@/lib/radar";

export const AREAS: Area[] = ["Enrollment", "Finance", "Facilities", "Systems"];

const qs = (base: string, scope: SchoolScope, area?: string) => {
  const p = new URLSearchParams({ ...(scope === "all" ? { scope: "all" } : {}), ...(area ? { area } : {}) }).toString();
  return p ? `${base}?${p}` : base;
};

export function ScopeToggle({ base, scope, area }: { base: string; scope: SchoolScope; area?: string }) {
  const cls = (on: boolean) =>
    `rounded-full border px-3 py-1 ${on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2"}`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Which schools to include">
      <span className="text-muted">Schools:</span>
      <Link href={qs(base, "default", area)} aria-current={scope === "default" ? "page" : undefined} className={cls(scope === "default")}>25 parish elementary</Link>
      <Link href={qs(base, "all", area)} aria-current={scope === "all" ? "page" : undefined} className={cls(scope === "all")}>All 33 listed</Link>
    </div>
  );
}

/** One tile per area with alert counts. Links go to the Alerts page, filtered. */
export function AreaTiles({ alerts, scope, active, filter = false }: { alerts: Alert[]; scope: SchoolScope; active?: Area; filter?: boolean }) {
  const base = "/alerts";
  const count = (ar: Area, s: Severity) => alerts.filter((a) => a.area === ar && a.severity === s).length;
  return (
    <section aria-label="Alerts by area" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {AREAS.map((ar) => {
        const on = active === ar;
        return (
          <Link key={ar} href={qs(base, scope, on ? undefined : ar)} aria-pressed={filter ? on : undefined}
            className={`rounded-xl border bg-surface p-4 hover:bg-surface-2 ${on ? "border-accent ring-1 ring-accent" : "border-border"}`}>
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>{ar}</span>
              <span className="text-faint">{on ? "Filtered ✕" : filter ? "Filter" : "View →"}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm tabular">
              <span><span aria-hidden="true" style={{ color: "var(--critical)" }}>▲</span> {count(ar, "critical")} critical</span>
              <span><span aria-hidden="true" style={{ color: "var(--serious)" }}>◆</span> {count(ar, "serious")} serious</span>
              <span className="text-muted"><span aria-hidden="true" style={{ color: "var(--warning)" }}>●</span> {count(ar, "warning")} watch</span>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

export function SchoolAlerts({ id, name, alerts }: { id: string; name: string; alerts: Alert[] }) {
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:gap-3">
      <div className="w-24 shrink-0"><SeverityPill s={alerts[0].severity} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <RiskSchoolRef id={id} name={name} provenance={provenanceOf(alerts.map((a) => ({ provenance: a.provenance === "REAL" ? "REAL" : "SAMPLE" })))} href={`/schools/${id}`} />
          <span className="text-faint"> · {alerts.length} item{alerts.length > 1 ? "s" : ""}</span>
        </div>
        <ul className="mt-1 space-y-1">
          {alerts.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span aria-hidden="true" style={{ color: `var(--${a.severity})` }}>{a.severity === "critical" ? "▲" : a.severity === "serious" ? "◆" : "●"}</span>
              <span className="sr-only">{a.severity}: </span>
              <span className="min-w-0">
                <span className="text-muted">{a.area}:</span> {a.title}
                {a.provenance !== "REAL" && <span className="ml-1.5 rounded border border-dashed border-sample-border px-1 text-[10px] font-semibold text-sample-fg">simulated</span>}
                {a.detail && <span className="block text-xs text-muted">{a.detail}</span>}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

/** Group alerts by school, worst schools first. */
export function groupBySchool(alerts: Alert[]) {
  const sorted = [...alerts].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.area.localeCompare(b.area));
  const by = new Map<string, Alert[]>();
  for (const a of sorted) (by.get(a.schoolId) ?? by.set(a.schoolId, []).get(a.schoolId)!).push(a);
  const n = (al: Alert[], s: Severity) => al.filter((a) => a.severity === s).length;
  return [...by.entries()].sort(
    ([, x], [, y]) => n(y, "critical") - n(x, "critical") || n(y, "serious") - n(x, "serious") || y.length - x.length
  );
}
