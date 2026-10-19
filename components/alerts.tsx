import Link from "next/link";
import { SchoolLink } from "./Names";
import { SeverityPill } from "./ui";
import { SEVERITY_ORDER, type Alert, type Area, type Severity } from "@/lib/radar";
import type { School } from "@/lib/types";

export const AREAS: Area[] = ["Enrollment", "Finance", "Facilities", "Systems"];

/** One tile per area with alert counts, for the demo view. Tiles filter the list. */
export function AreaTiles({ alerts, active }: { alerts: Alert[]; active?: Area }) {
  const count = (ar: Area, s: Severity) => alerts.filter((a) => a.area === ar && a.severity === s).length;
  return (
    <section aria-label="Alerts by area" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {AREAS.map((ar) => {
        const on = active === ar;
        const href = on ? "/alerts?view=demo" : `/alerts?view=demo&area=${ar}`;
        return (
          <Link key={ar} href={href} aria-pressed={on}
            className={`sample-edge rounded-xl border bg-surface p-4 hover:bg-surface-2 ${on ? "border-accent ring-1 ring-accent" : "border-border"}`}>
            <div className="flex items-center justify-between text-xs font-medium text-muted">
              <span>{ar}</span>
              <span>{on ? "Filtered ✕" : "Filter"}</span>
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

export function SchoolAlerts({ school, alerts }: { school: School; alerts: Alert[] }) {
  return (
    <li className="flex flex-col gap-2 border-b border-border py-3 last:border-0 sm:flex-row sm:gap-3">
      <div className="w-24 shrink-0"><SeverityPill s={alerts[0].severity} /></div>
      <div className="min-w-0 flex-1">
        <div className="text-sm">
          <SchoolLink school={school} />
          <span className="text-muted"> · {alerts.length} item{alerts.length > 1 ? "s" : ""}</span>
        </div>
        <ul className="mt-1 space-y-1">
          {alerts.map((a, i) => (
            <li key={i} className="flex gap-2 text-sm">
              <span aria-hidden="true" style={{ color: `var(--${a.severity})` }}>{a.severity === "critical" ? "▲" : a.severity === "serious" ? "◆" : "●"}</span>
              <span className="sr-only">{a.severity === "warning" ? "watch" : a.severity}: </span>
              <span className="min-w-0">
                <span className="text-muted">{a.area}:</span> {a.title}
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
