import Link from "next/link";
import { AREAS, AreaTiles, SchoolAlerts, groupBySchool } from "@/components/alerts";
import { stateDataLabel } from "@/components/school";
import { Card, DemoNote, PageHeader } from "@/components/ui";
import { CDE_PUBLISHED, DEMO_AS_OF } from "@/lib/config";
import { dateLong } from "@/lib/format";
import { RULES } from "@/lib/radar";
import { demoView, realView, type SchoolView } from "@/lib/system";

export const metadata = { title: "Alerts · School Vitality Prototype" };

function List({ views, filter }: { views: SchoolView[]; filter?: string }) {
  const bySchool = new Map(views.map((v) => [v.school.id, v.school]));
  const groups = groupBySchool(views.flatMap((v) => v.alerts).filter((a) => !filter || a.area === filter));
  const urgent = groups.filter(([, al]) => al[0].severity !== "warning");
  const watch = groups.filter(([, al]) => al[0].severity === "warning");
  const quiet = views.length - groups.length;
  const demo = views[0]?.school.demo ?? false;
  return (
    <>
      <Card id="att-h" p={demo ? "SAMPLE" : "REAL"} title={<>Critical or serious{filter ? ` · ${filter}` : ""} <span className="font-normal text-muted">({urgent.length} schools)</span></>}>
        {urgent.length === 0 ? <p className="text-sm text-muted">No school has a critical or serious item.</p> : (
          <ul>{urgent.map(([id, al]) => <SchoolAlerts key={id} school={bySchool.get(id)!} alerts={al} />)}</ul>
        )}
      </Card>
      {watch.length > 0 && (
        <Card id="watch-h" p={demo ? "SAMPLE" : "REAL"} title={<>Watch items only <span className="font-normal text-muted">({watch.length} schools)</span></>}>
          <ul>{watch.map(([id, al]) => <SchoolAlerts key={id} school={bySchool.get(id)!} alerts={al} />)}</ul>
        </Card>
      )}
      {quiet > 0 && <p className="text-sm text-muted">{quiet} school{quiet > 1 ? "s have" : " has"} no items{filter ? ` in ${filter}` : ""}.</p>}
    </>
  );
}

export default async function AlertsPage({ searchParams }: { searchParams: Promise<{ view?: string; area?: string }> }) {
  const sp = await searchParams;
  const demo = sp.view === "demo";
  const area = demo ? AREAS.find((a) => a === sp.area) : undefined;
  const views = demo ? demoView() : realView();
  const tab = (on: boolean) => `rounded-full border px-3 py-1 ${on ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:bg-surface-2"}`;

  return (
    <div className="space-y-8">
      <PageHeader title="Alerts" sub={demo
        ? <>Demo system: every area, for {views.length} fictional schools, simulated data as of {dateLong(DEMO_AS_OF)}.</>
        : <>Enrollment items for the {views.length} parish elementary schools, worst first. {stateDataLabel(CDE_PUBLISHED)}.</>}>
        <div className="flex flex-wrap gap-2 text-sm" role="group" aria-label="Which schools">
          <Link href="/alerts" aria-current={!demo ? "page" : undefined} className={tab(!demo)}>Real schools (public data)</Link>
          <Link href="/alerts?view=demo" aria-current={demo ? "page" : undefined} className={tab(demo)}>Demo schools (all areas)</Link>
        </div>
      </PageHeader>
      {demo && <DemoNote />}
      {demo && <AreaTiles alerts={views.flatMap((v) => v.alerts)} active={area} />}
      <List views={views} filter={area} />
      <Card id="rules-h" title="How alerts are raised">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {RULES.filter((r) => (demo ? !area || r.area === area : r.area === "Enrollment")).map((r) => <li key={r.description}><span className="font-medium">{r.area}:</span> {r.description}</li>)}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Thresholds are starting points for discussion, not policy. They live in <code>lib/radar.ts</code>.
          {!demo && " Rules that need internal data (re-enrollment, inquiries, finance, facilities, data feeds) run only in the demo."}
        </p>
      </Card>
    </div>
  );
}
