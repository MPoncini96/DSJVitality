"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "vitality:slimbar-dismissed";

/** One-line prototype notice under the header. Dismissible for the browser session. */
export function SlimBar() {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      if (sessionStorage.getItem(KEY) === "1") setHidden(true);
    } catch {
      /* storage blocked: keep showing the bar */
    }
  }, []);
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try { sessionStorage.setItem(KEY, "1"); } catch { /* ignore */ }
  };
  return (
    <div role="note" aria-label="About this prototype" className="border-b border-border bg-surface-2">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-1.5 text-xs text-muted sm:px-6">
        <p className="min-w-0 flex-1">
          <span className="font-semibold text-text">Prototype</span>
          <span aria-hidden="true"> · </span>real public data where marked
          <span aria-hidden="true"> · </span>
          simulated internal data shown <span className="sample-edge rounded-sm border border-sample-border px-1 text-sample-fg">hatched</span>
          <span aria-hidden="true"> · </span>
          <Link href="/about" className="text-accent underline underline-offset-2">Learn more →</Link>
        </p>
        <button type="button" onClick={dismiss} className="shrink-0 rounded px-1.5 py-0.5 text-muted hover:bg-surface hover:text-text" aria-label="Dismiss this notice for this session">
          ✕
        </button>
      </div>
    </div>
  );
}
