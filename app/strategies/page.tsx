import Link from "next/link";
import { SchoolLink } from "@/components/Names";
import { stateDataLabel } from "@/components/school";
import { Card, PageHeader } from "@/components/ui";
import { BASE_YEAR, CDE_PUBLISHED } from "@/lib/config";
import { getMatchReview } from "@/lib/data";
import { schoolYear, signedPct } from "@/lib/format";
import { BRIGHT_SPOTS, LEVERS, PATTERNS, SOURCES, leverByKey } from "@/lib/strategies";
import { realView } from "@/lib/system";

export const metadata = { title: "Enrollment strategies · School Vitality Prototype" };

const STEPS = [
  { name: "Find", text: "Use the state data to find schools doing better than their numbers would predict: holding enrollment while births fall, winning more of the local kindergartners, or adding students in later grades." },
  { name: "Ask", text: "Visit and ask what they do differently: how they handle inquiries and tours, where new families come from, why families stay. Talk to the principal, the office manager and a few parents." },
  { name: "Check", text: "Keep what another school could realistically copy without new money or outside experts, and that doesn't depend on one remarkable person." },
  { name: "Share", text: "Present it at a principals' meeting, pair a principal who wants to try it with the one who does it, and put it in that school's Turnaround plan." },
  { name: "Measure", text: "Pick one number to watch (inquiry-to-tour rate, re-enrollment, kindergarten applications) and look again at the next state data release." },
];

const cite = (ids: string[]) => ids.map((id) => {
  const n = SOURCES.findIndex((s) => s.id === id) + 1;
  return <a key={id} href={`#src-${id}`} className="text-accent underline underline-offset-2">[{n}]</a>;
});

export default function Strategies() {
  const views = realView();
  // A school whose state file is flagged for review (gaps, large jumps) isn't held up as a model until it's confirmed.
  const flagged = new Set(getMatchReview().filter((r) => r.needsReview).map((r) => r.schoolId));
  const flaggedNames = views.filter((v) => flagged.has(v.school.id)).map((v) => v.school.name);
  return (
    <div className="space-y-8">
      <PageHeader title="Enrollment strategies"
        sub={<>Start with the schools that are already doing well: find them in the data, ask what they do, and help other schools try it. {stateDataLabel(CDE_PUBLISHED)}.</>} />

      <Card id="how-h" title="The approach: learn from bright spots">
        <p className="max-w-3xl text-sm">
          Most good answers to falling enrollment already exist somewhere in the system. Researchers call this positive deviance {cite(["pd"])};
          the Heath brothers put it as &quot;find a bright spot and clone it&quot; {cite(["switch"])}. It suits a diocese well: 25 schools facing the
          same county, the same births decline and the same public TK expansion, some of them doing noticeably better than others.
        </p>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.name} className="rounded-lg border border-border bg-surface-2 p-3">
              <div className="text-xs font-semibold text-accent">Step {i + 1}</div>
              <div className="text-sm font-semibold">{s.name}</div>
              <p className="mt-1 text-xs text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </Card>

      <section aria-labelledby="bright-h" className="space-y-4">
        <div className="space-y-1">
          <h2 id="bright-h" className="text-lg font-semibold tracking-tight">Bright spots in the state data</h2>
          <p className="max-w-3xl text-sm text-muted">
            The data shows <em>what</em> is going right, not <em>why</em>. Each list ends with the question to ask. Kindergarten classes are small,
            so a single year can swing these numbers; treat them as a reason for a conversation, not a ranking. Schools whose state data is flagged for
            review are left out until the numbers are confirmed ({flaggedNames.join(", ")}).
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {BRIGHT_SPOTS.map((b) => {
            const hits = views.filter((v) => !flagged.has(v.school.id) && b.test(v.metrics));
            return (
              <Card key={b.key} id={`bs-${b.key}`} title={<>{b.title} <span className="font-normal text-muted">({hits.length})</span></>}>
                <p className="text-xs text-muted">{b.shows}</p>
                <ul className="mt-3 space-y-1.5 text-sm">
                  {hits.map((v) => {
                    const e = v.metrics.enrollment, m = v.metrics.market;
                    const fig = b.key === "holding" ? `${signedPct(e.changeSinceBase)} since ${schoolYear(BASE_YEAR)}; births ${signedPct(m.births5Change)}`
                      : b.key === "kshare" ? `share ${signedPct(m.shareTrend)} a year`
                      : `${signedPct((e.cohortRetention ?? 1) - 1)} per grade`;
                    return (
                      <li key={v.school.id} className="flex flex-wrap justify-between gap-x-2">
                        <SchoolLink school={v.school} /><span className="text-xs text-muted tabular">{fig}</span>
                      </li>
                    );
                  })}
                  {hits.length === 0 && <li className="text-muted">None this year.</li>}
                </ul>
                <p className="mt-3 border-t border-border pt-3 text-sm"><span className="font-medium">Ask:</span> {b.ask}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="pat-h" className="space-y-4">
        <div className="space-y-1">
          <h2 id="pat-h" className="text-lg font-semibold tracking-tight">Where schools are losing students</h2>
          <p className="max-w-3xl text-sm text-muted">Three patterns the public data can see, and the strategies to look at first for each. Each school&apos;s page shows which apply to it.</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {PATTERNS.map((p) => {
            const n = views.filter((v) => p.test(v.metrics)).length;
            return (
              <Card key={p.key} id={`pat-${p.key}`} title={p.title}>
                <p className="text-2xl font-semibold tabular">{n} <span className="text-sm font-normal text-muted">of {views.length} schools</span></p>
                <p className="mt-1 text-xs text-muted">{p.shows}</p>
                <p className="mt-3 text-sm">Start with: {p.levers.map((k, i) => <span key={k}>{i > 0 && ", "}<a href={`#lever-${k}`} className="text-accent underline underline-offset-2">{leverByKey(k).title}</a></span>)}</p>
              </Card>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="lev-h" className="space-y-4">
        <div className="space-y-1">
          <h2 id="lev-h" className="text-lg font-semibold tracking-tight">Strategies from the research</h2>
          <p className="max-w-3xl text-sm text-muted">
            Practices that Catholic school systems and researchers recommend, each with the number that shows whether it&apos;s working. They come
            from other dioceses and national studies; the bright-spot conversations show which ones fit here.
          </p>
        </div>
        {LEVERS.map((l) => (
          <Card key={l.key} id={`lever-${l.key}`} title={l.title}>
            <p className="mb-3 max-w-3xl text-sm text-muted">{l.summary}</p>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border text-xs text-muted">
                  <tr>
                    <th scope="col" className="py-2 pr-4 text-left font-medium">Strategy</th>
                    <th scope="col" className="py-2 pr-4 text-left font-medium">Why it works</th>
                    <th scope="col" className="py-2 pr-4 text-left font-medium">Number to watch</th>
                    <th scope="col" className="py-2 text-left font-medium"><span className="sr-only">Sources</span></th>
                  </tr>
                </thead>
                <tbody>
                  {l.strategies.map((s) => (
                    <tr key={s.what} className="border-b border-border align-top last:border-0">
                      <td className="py-2 pr-4">{s.what}</td>
                      <td className="py-2 pr-4 text-muted">{s.why}</td>
                      <td className="py-2 pr-4 text-muted">{s.metric}</td>
                      <td className="py-2 whitespace-nowrap text-xs">{cite(s.sources)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </section>

      <Card id="next-h" title="Putting it to work">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Each school&apos;s plan is written with its pastor and principal; this page is a menu, not a prescription.</li>
          <li>In the <Link href="/turnaround" className="text-accent underline underline-offset-2">Turnaround Program</Link>, the Plan step picks four to six of these, each with an owner, a due date and its number to watch.</li>
          <li>Most of the numbers to watch (inquiries, tours, re-enrollment) aren&apos;t public. A shared admissions and re-enrollment tracker across schools would let the Radar show them; the <Link href="/demo" className="text-accent underline underline-offset-2">demo schools</Link> show how that would look.</li>
        </ul>
      </Card>

      <Card id="src-h" title="Sources">
        <ol className="space-y-2 text-sm">
          {SOURCES.map((s, i) => (
            <li key={s.id} id={`src-${s.id}`} className="scroll-mt-24">
              <span className="text-muted">[{i + 1}]</span> <a href={s.url} className="text-accent underline underline-offset-2">{s.title}</a>, {s.publisher}.
              <span className="block text-xs text-muted">{s.note}</span>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
