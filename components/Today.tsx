"use client";

/**
 * Anything that compares a date with today runs in the browser, so a statically built
 * page never shows a stale "coming up" or misses an overdue check-in.
 */
import { useEffect, useState } from "react";
import { around, type CalendarItem } from "@/lib/calendar";

function useToday(): Date | null {
  const [t, setT] = useState<Date | null>(null);
  useEffect(() => {
    const n = new Date();
    setT(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())));
  }, []);
  return t;
}

const iso = (t: Date) => t.toISOString().slice(0, 10);
const fmt = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const fmtY = (s: string) => new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function Item({ c }: { c: CalendarItem }) {
  return (
    <li className="text-sm">
      <div className="font-medium">{c.title}</div>
      <div className="text-xs text-muted tabular">
        {fmt(c.start)}{c.end !== c.start ? ` – ${fmt(c.end)}` : ""} · {c.area}
        {c.typical ? " · typical timing" : ""}
        {c.source && <> · <a className="text-accent underline underline-offset-2" href={c.source}>CDE</a></>}
      </div>
    </li>
  );
}

export function ComingUp({ next }: { next: { title: string; when: string; source: string } }) {
  const today = useToday();
  if (!today) return <p className="text-sm text-muted">Loading dates…</p>;
  const { upcoming, passed } = around(today);
  return (
    <div>
      <p className="mb-3 text-xs text-muted">Next 90 days from today, {fmtY(iso(today))}.</p>
      <ul className="space-y-3">{upcoming.map((c) => <Item key={c.title + c.start} c={c} />)}</ul>
      <p className="mt-3 border-t border-border pt-3 text-sm">
        <span className="font-medium">{next.title}</span>
        <span className="block text-xs text-muted">{next.when} · <a className="text-accent underline underline-offset-2" href={next.source}>CDE</a></span>
      </p>
      {passed.length > 0 && (
        <details className="mt-3 text-xs text-muted">
          <summary className="cursor-pointer">Recently passed ({passed.length})</summary>
          <ul className="mt-2 space-y-2">{passed.map((c) => <Item key={c.title + c.start} c={c} />)}</ul>
        </details>
      )}
      <p className="mt-3 text-xs text-muted">Typical timings are to be confirmed with the Department of Catholic Schools.</p>
    </div>
  );
}

/** A check-in date: red "Overdue" once it is in the past. */
export function CheckinDate({ date }: { date: string }) {
  const today = useToday();
  const overdue = today !== null && date < iso(today);
  return (
    <span className="tabular whitespace-nowrap">
      {fmtY(date)}
      {overdue && <span className="ml-1.5 font-semibold" style={{ color: "var(--critical)" }}><span aria-hidden="true">▲ </span>Overdue</span>}
    </span>
  );
}

type Status = "Done" | "On track" | "At risk" | "Not started";
const STATUS: Record<Status | "Overdue", { icon: string; color: string }> = {
  Done: { icon: "✓", color: "var(--good)" },
  "On track": { icon: "→", color: "var(--series-1)" },
  "At risk": { icon: "◆", color: "var(--serious)" },
  "Not started": { icon: "○", color: "var(--muted)" },
  Overdue: { icon: "▲", color: "var(--critical)" },
};

/** Action status, shown as Overdue once the due date passes without it being done. */
export function ActionStatus({ status, due }: { status: Status; due: string }) {
  const today = useToday();
  const s: Status | "Overdue" = today && status !== "Done" && due < iso(today) ? "Overdue" : status;
  const v = STATUS[s];
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold whitespace-nowrap" style={s === "Overdue" ? { color: v.color } : undefined}>
      <span aria-hidden="true" style={{ color: v.color }}>{v.icon}</span>{s}
    </span>
  );
}

/** "2 done · 1 on track · 2 at risk or overdue", counted against today. */
export function ActionSummary({ actions }: { actions: { status: Status; due: string }[] }) {
  const today = useToday();
  if (!actions.length) return <>Plan not yet written</>;
  const st = actions.map((a) => (today && a.status !== "Done" && a.due < iso(today) ? "Overdue" : a.status));
  const n = (k: string) => st.filter((x) => x === k).length;
  return <>{n("Done")} done · {n("On track")} on track · {n("At risk") + n("Overdue")} at risk or overdue</>;
}
