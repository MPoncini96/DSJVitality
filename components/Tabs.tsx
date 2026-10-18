"use client";

import { useEffect, useId, useState, type ReactNode } from "react";

/** Accessible tabs (arrow keys move between tabs). Remembers the tab in the URL hash. */
export function Tabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  const [active, setActive] = useState(tabs[0].id);
  const base = useId();

  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (tabs.some((t) => t.id === h)) setActive(h);
  }, [tabs]);

  const select = (id: string) => {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
  };

  return (
    <div>
      <div role="tablist" aria-label="School sections" className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            id={`${base}-tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={active === t.id}
            aria-controls={`${base}-panel-${t.id}`}
            tabIndex={active === t.id ? 0 : -1}
            onClick={() => select(t.id)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
              const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
              select(next.id);
              document.getElementById(`${base}-tab-${next.id}`)?.focus();
            }}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
              active === t.id ? "border-accent font-semibold text-text" : "border-transparent text-muted hover:text-text"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div
          key={t.id}
          id={`${base}-panel-${t.id}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${t.id}`}
          hidden={active !== t.id}
          className="pt-6"
        >
          {t.content}
        </div>
      ))}
    </div>
  );
}
