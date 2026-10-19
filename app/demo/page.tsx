import { SchoolLink } from "@/components/Names";
import { Card, DemoNote, PageHeader, TierPill } from "@/components/ui";
import { BASE_YEAR, DEMO_AS_OF } from "@/lib/config";
import { dateLong, pct, schoolYear, signedPct } from "@/lib/format";
import { demoView } from "@/lib/system";

export const metadata = { title: "Demo schools · School Vitality Prototype" };

export default function DemoIndex() {
  const views = demoView().sort((a, b) => (a.health.composite?.score ?? 0) - (b.health.composite?.score ?? 0));
  return (
    <div className="space-y-6">
      <PageHeader title="Demo schools"
        sub={<>{views.length} fictional schools that carry the internal data a director would see: budgets, cash, assistance, facilities,
          admissions, data feeds and the Turnaround Program. Simulated data as of {dateLong(DEMO_AS_OF)}.</>} />
      <DemoNote />
      <Card title="All demo schools, weakest composite first" p="SAMPLE" id="demo-h">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm tabular">
            <caption className="sr-only">Fictional demo schools with simulated scores</caption>
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-2 py-2 text-left font-medium">School</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Students</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Since {schoolYear(BASE_YEAR)}</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Composite</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Matrix</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Days cash</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">FCI</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Program</th>
              </tr>
            </thead>
            <tbody>
              {views.map((v) => (
                <tr key={v.school.id} className="border-b border-border last:border-0">
                  <td className="px-2 py-2"><SchoolLink school={v.school} /></td>
                  <td className="px-2 py-2 text-right">{v.metrics.enrollment.latest}</td>
                  <td className="px-2 py-2 text-right">{signedPct(v.metrics.enrollment.changeSinceBase)}</td>
                  <td className="px-2 py-2 text-right">{v.health.composite?.score ?? "—"}</td>
                  <td className="px-2 py-2"><TierPill t={v.health.quadrant} /></td>
                  <td className="px-2 py-2 text-right">{v.metrics.finance.daysCash === null ? "—" : Math.round(v.metrics.finance.daysCash)}</td>
                  <td className="px-2 py-2 text-right">{pct(v.metrics.facilities.fci)}</td>
                  <td className="px-2 py-2 text-muted">{v.turnaround ? v.turnaround.phase : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
