"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { MixedProvenance } from "@/lib/data";

interface NamesState {
  anonymize: boolean;
  setAnonymize: (v: boolean) => void;
  labels: Record<string, string>;
}

const Ctx = createContext<NamesState | null>(null);
const KEY = "vitality.anonymize";

/**
 * Global "anonymize school names" state. Defaults to ON whenever the enrollment
 * data is SAMPLE, so fake numbers are never shown next to a real school's name
 * unless the viewer deliberately switches names on.
 */
export function NamesProvider({
  labels,
  defaultAnonymize,
  children,
}: {
  labels: Record<string, string>;
  defaultAnonymize: boolean;
  children: ReactNode;
}) {
  const [anonymize, setState] = useState(defaultAnonymize);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v === "1" || v === "0") setState(v === "1");
    } catch {
      /* storage unavailable: keep default */
    }
  }, []);

  const setAnonymize = (v: boolean) => {
    setState(v);
    try {
      window.localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  return <Ctx.Provider value={{ anonymize, setAnonymize, labels }}>{children}</Ctx.Provider>;
}

export function useNames() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useNames must be used inside NamesProvider");
  return c;
}

/** Renders a school's name, or its anonymous label when anonymize is on. */
export function SchoolName({ id, name }: { id: string; name: string }) {
  const { anonymize, labels } = useNames();
  return <>{anonymize ? labels[id] ?? "School" : name}</>;
}

/** Hides identifying location text (city, ZIP) while anonymized. */
export function SchoolLocation({ text }: { text: string }) {
  const { anonymize } = useNames();
  return anonymize ? <span className="text-faint">hidden</span> : <>{text}</>;
}

export function AnonymizeToggle() {
  const { anonymize, setAnonymize } = useNames();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={anonymize}
      onClick={() => setAnonymize(!anonymize)}
      className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text hover:bg-surface-2"
    >
      <span
        aria-hidden="true"
        className={
          "relative inline-block h-4 w-7 rounded-full transition-colors " + (anonymize ? "bg-accent" : "bg-border")
        }
      >
        <span
          className={
            "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all " + (anonymize ? "left-3.5" : "left-0.5")
          }
        />
      </span>
      {anonymize ? "Names hidden" : "Names shown"}
    </button>
  );
}

/**
 * A school reference inside a RISK context (alert, tier, Matrix, Turnaround).
 * Rule: a risk flag built on any SAMPLE input never shows a real school name,
 * whatever the Names switch says. When names are switched on, such references are
 * also not linked, so the anonymous letter can't be matched to a named profile.
 */
export function RiskSchoolRef({
  id, name, provenance, href,
}: { id: string; name: string; provenance: MixedProvenance; href?: string }) {
  const { anonymize, labels } = useNames();
  const forced = provenance !== "REAL";
  const label = anonymize || forced ? labels[id] ?? "School" : name;
  const linkable = href && (anonymize || !forced);
  const title = forced && !anonymize ? "Name hidden: this flag uses simulated data" : undefined;
  return linkable ? (
    <Link href={href} className="font-medium text-text underline decoration-border underline-offset-2 hover:decoration-accent">
      {label}
    </Link>
  ) : (
    <span className="font-medium" title={title}>{label}</span>
  );
}

/** Plain (non-risk) school link that follows the Names switch. */
export function SchoolLink({ id, name }: { id: string; name: string }) {
  const { anonymize, labels } = useNames();
  return (
    <Link href={`/schools/${id}`} className="font-medium text-text underline decoration-border underline-offset-2 hover:decoration-accent">
      {anonymize ? labels[id] ?? "School" : name}
    </Link>
  );
}

/**
 * Wraps risk content (scores, tiers, alerts) on a page that is about one named school.
 * If names are shown and the content uses SAMPLE inputs, the content is withheld.
 */
export function RiskGate({ provenance, children }: { provenance: MixedProvenance; children: ReactNode }) {
  const { anonymize, setAnonymize } = useNames();
  if (anonymize || provenance === "REAL") return <>{children}</>;
  return (
    <div className="rounded-lg border border-dashed border-sample-border bg-sample-bg p-4 text-sm text-sample-fg">
      Scores and risk flags for this school use simulated data, so they are not shown next to its real name.{" "}
      <button type="button" onClick={() => setAnonymize(true)} className="font-semibold underline underline-offset-2">
        Hide names to view them
      </button>
      .
    </div>
  );
}

/** Text that is shown only when names are visible (address, phone, website). */
export function WhenNamed({ children, fallback = null }: { children: ReactNode; fallback?: ReactNode }) {
  const { anonymize } = useNames();
  return <>{anonymize ? fallback : children}</>;
}
