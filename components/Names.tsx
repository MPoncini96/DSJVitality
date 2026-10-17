"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

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
