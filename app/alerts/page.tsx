import { AREAS, AreaTiles, ScopeToggle, SchoolAlerts, groupBySchool } from "@/components/alerts";
import { Card, PageHeader, SampleBanner } from "@/components/ui";
import type { SchoolScope } from "@/lib/data";
import { dateLong } from "@/lib/format";
import { AS_OF } from "@/lib/metrics";
import { RULES } from "@/lib/radar";
import { alertsProvenance, systemView } from "@/lib/system";

export const metadata = { title: "Alerts · School Vitality Prototype" };

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ scope?: string; area?: string }> }) {
  const sp = await searchParams;
  const scope: SchoolScope = sp.scope === "all" ? "all" : "default";
  const area = AREAS.find((a) => a === sp.area);
  const views = systemView(scope);
  const nameOf = new Map(views.map((v) => [v.school.id, v.school.name]));
  const all = views.flatMap((v) => v.alerts);
  const groups = groupBySchool(all.filter((a) => !area || a.area === area));
  const urgent = groups.filter(([, al]) => al[0].severity !== "warning");
  const watch = groups.filter(([, al]) => al[0].severity === "warning");
  const quiet = views.length - groups.length;

  return (
    <div className="space-y-8">
      <PageHeader title="Alerts" sub={<>Every school with an item that needs attention, worst first, as of {dateLong(AS_OF)}.</>}>
        <ScopeToggle base="/alerts" scope={scope} area={area} />
      </PageHeader>
      <SampleBanner />
      <AreaTiles alerts={all} scope={scope} active={area} filter />

      <Card id="att-h" p={alertsProvenance(views)}
        title={<>Schools needing attention{area ? ` · ${area}` : ""} <span className="font-normal text-muted">({urgent.length})</span></>}>
        {urgent.length === 0 ? (
          <p className="text-sm text-muted">No school has a critical or serious item{area ? ` in ${area}` : ""}.</p>
        ) : (
          <ul>{urgent.map(([id, al]) => <SchoolAlerts key={id} id={id} name={nameOf.get(id)!} alerts={al} />)}</ul>
        )}
      </Card>

      {watch.length > 0 && (
        <Card id="watch-h" title={<>Watch items only <span className="font-normal text-muted">({watch.length})</span></>}>
          <ul>{watch.map(([id, al]) => <SchoolAlerts key={id} id={id} name={nameOf.get(id)!} alerts={al} />)}</ul>
        </Card>
      )}
      {quiet > 0 && <p className="text-sm text-muted">{quiet} school{quiet > 1 ? "s have" : " has"} no items{area ? ` in ${area}` : ""}.</p>}

      <Card id="rules-h" title="How alerts are raised">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {RULES.filter((r) => !area || r.area === area).map((r) => <li key={r.description}><span className="font-medium">{r.area}:</span> {r.description}</li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">Thresholds are starting points for discussion, not policy. They live in <code>lib/radar.ts</code>.</p>
      </Card>
    </div>
  );
}
