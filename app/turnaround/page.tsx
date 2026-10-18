import Link from "next/link";
import { RiskSchoolRef } from "@/components/Names";
import { Card, Illustrative, PageHeader, SampleBanner, TierPill } from "@/components/ui";
import { provenanceOf } from "@/lib/data";
import { dateMed, dateShort } from "@/lib/format";
import { AS_OF } from "@/lib/metrics";
import { systemView } from "@/lib/system";
import type { TurnaroundAction } from "@/lib/types";

export const metadata = { title: "Turnaround Program · School Vitality Prototype" };

const STEPS = [
  { name: "Identify", text: "The Matrix and Radar flag a school: shrinking enrollment with weak finances, or a critical alert that persists two months." },
  { name: "Assess", text: "Site visit with pastor and principal. Confirm the numbers, find the causes, agree on what success looks like." },
  { name: "Plan", text: "Four to six actions, each with an owner, a due date and one metric. Shared with the Department of Catholic Schools." },
  { name: "Implement", text: "Monthly check-ins. Actions at risk get help early: coaching, marketing support, a bridge budget." },
  { name: "Monitor", text: "Actions done; watch the metrics through one full enrollment cycle." },
  { name: "Exit", text: "Proposed criteria: composite score of 60+ in two consecutive reviews, enrollment flat or growing, operating margin of zero or better." },
];

const STATUS: Record<TurnaroundAction["status"] | "Overdue", { icon: string; color: string }> = {
  Done: { icon: "✓", color: "var(--good)" },
  "On track": { icon: "→", color: "var(--series-1)" },
  "At risk": { icon: "◆", color: "var(--serious)" },
  "Not started": { icon: "○", color: "var(--faint)" },
  Overdue: { icon: "▲", color: "var(--critical)" },
};

function StatusPill({ s }: { s: keyof typeof STATUS }) {
  const v = STATUS[s];
  return (
    <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap"
      style={{ borderColor: v.color, background: `color-mix(in srgb, ${v.color} 12%, transparent)` }}>
      <span aria-hidden="true" style={{ color: v.color }}>{v.icon}</span>{s}
    </span>
  );
}

const effectiveStatus = (a: TurnaroundAction): keyof typeof STATUS =>
  a.status !== "Done" && a.due < AS_OF ? "Overdue" : a.status;

export default function Turnaround() {
  const views = systemView("default");
  const inProgram = views.filter((v) => v.turnaround).sort((a, b) => a.turnaround!.entered.localeCompare(b.turnaround!.entered));
  const flagged = views.filter(
    (v) => !v.turnaround && (v.health.quadrant === "Turnaround candidate" || v.health.composite.tier === "Turnaround candidate")
  );
  const exitReview = inProgram.filter((v) => v.health.quadrant === "Stable" && (v.health.composite.score ?? 0) >= 60);
  const p = provenanceOf(inProgram.map((v) => v.turnaround!));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Turnaround Program"
        sub="How schools are identified, supported and brought back to stability. The roster, action plans and dates below are simulated; the process is a proposal."
      />
      <SampleBanner />

      <Card title="How the program works" id="steps-h">
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.name} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="text-xs font-semibold text-accent">Step {i + 1}</div>
              <div className="text-sm font-semibold">{s.name}</div>
              <p className="mt-1 text-xs text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <Card title={<>Schools in the program <span className="font-normal text-muted">({inProgram.length})</span></>} p={p} id="roster-h">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm tabular">
            <caption className="sr-only">Schools currently in the Turnaround Program</caption>
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th scope="col" className="px-2 py-2 text-left font-medium">School</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Phase</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Since</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Matrix</th>
                <th scope="col" className="px-2 py-2 text-right font-medium">Composite <Illustrative /></th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Actions</th>
                <th scope="col" className="px-2 py-2 text-left font-medium">Next check-in</th>
              </tr>
            </thead>
            <tbody>
              {inProgram.map((v) => {
                const st = v.actions.map(effectiveStatus);
                const n = (k: string) => st.filter((x) => x === k).length;
                return (
                  <tr key={v.school.id} className="border-b border-border last:border-0">
                    <td className="px-2 py-2"><RiskSchoolRef id={v.school.id} name={v.school.name} provenance={v.turnaround!.provenance} href={`/schools/${v.school.id}`} /></td>
                    <td className="px-2 py-2">{v.turnaround!.phase}</td>
                    <td className="px-2 py-2 text-muted">{dateMed(v.turnaround!.entered)}</td>
                    <td className="px-2 py-2"><TierPill t={v.health.quadrant} /></td>
                    <td className="px-2 py-2 text-right">{v.health.composite.score ?? "—"}</td>
                    <td className="px-2 py-2 text-xs text-muted">
                      {v.actions.length === 0 ? "Plan not yet written" : `${n("Done")} done · ${n("On track")} on track · ${n("At risk") + n("Overdue")} at risk/overdue`}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">{dateMed(v.turnaround!.nextCheckin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={<>Flagged, not in the program <span className="font-normal text-muted">({flagged.length})</span></>} p={provenanceOf(flagged.map((v) => ({ provenance: v.health.financial.provenance === "REAL" ? "REAL" : "SAMPLE" })))} id="flag-h">
          <p className="mb-3 text-xs text-muted">In the Matrix&apos;s turnaround quadrant or below 50 on the composite. Next step: an assessment visit.</p>
          {flagged.length === 0 ? <p className="text-sm text-muted">None.</p> : (
            <ul className="space-y-2 text-sm">
              {flagged.map((v) => (
                <li key={v.school.id} className="flex flex-wrap items-center justify-between gap-2">
                  <RiskSchoolRef id={v.school.id} name={v.school.name} provenance="SAMPLE" href={`/schools/${v.school.id}`} />
                  <span className="flex items-center gap-2 text-xs text-muted">
                    <TierPill t={v.health.quadrant} /> composite {v.health.composite.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title={<>Ready for an exit review <span className="font-normal text-muted">({exitReview.length})</span></>} p={p} id="exit-h">
          <p className="mb-3 text-xs text-muted">In the program, now in the Stable quadrant with a composite of 60 or more.</p>
          {exitReview.length === 0 ? <p className="text-sm text-muted">None yet.</p> : (
            <ul className="space-y-2 text-sm">
              {exitReview.map((v) => (
                <li key={v.school.id}><RiskSchoolRef id={v.school.id} name={v.school.name} provenance="SAMPLE" href={`/schools/${v.school.id}`} /></li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-labelledby="plans-h" className="space-y-4">
        <h2 id="plans-h" className="text-lg font-semibold tracking-tight">Action plans</h2>
        {inProgram.map((v) => (
          <Card key={v.school.id} p={p}
            title={<><RiskSchoolRef id={v.school.id} name={v.school.name} provenance="SAMPLE" /> <span className="font-normal text-muted">· {v.turnaround!.phase}</span></>}>
            {v.actions.length === 0 ? (
              <p className="text-sm text-muted">Assessment under way; the action plan is written at the end of this phase.</p>
            ) : (
              <div className="relative overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="text-xs text-muted">
                    <tr>
                      <th scope="col" className="py-1 pr-3 text-left font-medium">Area</th>
                      <th scope="col" className="py-1 pr-3 text-left font-medium">Action</th>
                      <th scope="col" className="py-1 pr-3 text-left font-medium">Owner</th>
                      <th scope="col" className="py-1 pr-3 text-left font-medium">Metric</th>
                      <th scope="col" className="py-1 pr-3 text-left font-medium">Due</th>
                      <th scope="col" className="py-1 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...v.actions].sort((a, b) => a.due.localeCompare(b.due)).map((a) => (
                      <tr key={a.actionId} className="border-t border-border align-top">
                        <td className="py-2 pr-3 text-muted">{a.area}</td>
                        <td className="py-2 pr-3">{a.action}</td>
                        <td className="py-2 pr-3 text-muted">{a.ownerRole}</td>
                        <td className="py-2 pr-3 text-muted">{a.metric}</td>
                        <td className="py-2 pr-3 whitespace-nowrap tabular">{dateMed(a.due)}</td>
                        <td className="py-2"><StatusPill s={effectiveStatus(a)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        ))}
      </section>

      <p className="text-xs text-muted">
        The Matrix itself is on the <Link href="/" className="underline underline-offset-2">Radar</Link>. School names on this page are
        always hidden while the inputs are simulated.
      </p>
    </div>
  );
}
