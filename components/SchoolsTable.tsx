"use client";

import { useMemo, useState } from "react";
import { SchoolLink } from "./Names";

export interface SchoolTableRow {
  id: string;
  name: string;
  city: string;
  type: string;
  latest: number | null;
  change5: number | null;
  spark: number[];
  /** tooltip text, e.g. earlier names */
  title?: string;
}

type SortKey = "name" | "city" | "type" | "latest" | "change5";

/**
 * Sparkline. One y-scale rule for every row: zero to the school's own peak, so the
 * height of the drop is proportional to the share of students lost. Start and end
 * values are printed beside it.
 */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const w = 64, h = 20;
  const max = Math.max(...values) || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 1 - (v / max) * (h - 2)}`).join(" ");
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <svg width={w} height={h} aria-hidden="true" className="inline-block align-middle">
        <line x1={0} x2={w} y1={h - 1} y2={h - 1} stroke="var(--border)" />
        <polyline points={pts} fill="none" stroke="var(--accent)" strokeWidth={1.5} />
      </svg>
      <span className="text-xs text-muted">{values[0]} → {values.at(-1)}</span>
    </span>
  );
}

export function SchoolsTable({ rows, latestLabel = "Enrollment", changeLabel = "Change", trendLabel = "Trend" }: {
  rows: SchoolTableRow[]; latestLabel?: string; changeLabel?: string; trendLabel?: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const sorted = useMemo(() => {
    const val = (r: SchoolTableRow) => {
      switch (sort.key) {
        case "name": return r.name;
        case "city": return r.city;
        case "type": return r.type;
        case "latest": return r.latest ?? -Infinity;
        case "change5": return r.change5 ?? -Infinity;
      }
    };
    return [...rows].sort((a, b) => {
      const x = val(a), y = val(b);
      const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true });
      return c * sort.dir;
    });
  }, [rows, sort]);

  const header = (key: SortKey, label: string, align: "left" | "right" = "left") => {
    const active = sort.key === key;
    return (
      <th scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={`px-3 py-2 font-medium text-${align}`}>
        <button
          type="button"
          onClick={() => setSort({ key, dir: active ? (sort.dir === 1 ? -1 : 1) : key === "name" || key === "city" || key === "type" ? 1 : -1 })}
          className="inline-flex items-center gap-1 hover:text-text"
        >
          {label}
          <span aria-hidden="true" className="text-faint">{active ? (sort.dir === 1 ? "▲" : "▼") : "↕"}</span>
        </button>
      </th>
    );
  };

  return (
    <div className="relative overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[640px] text-sm tabular">
        <caption className="sr-only">Schools with latest enrollment and change since the base year. Column headers sort the table.</caption>
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            {header("name", "School")}
            {header("city", "City")}
            {header("type", "Type")}
            {header("latest", latestLabel, "right")}
            {header("change5", changeLabel, "right")}
            <th scope="col" className="px-3 py-2 text-left font-medium">{trendLabel}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            return (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2"><span title={r.title}><SchoolLink id={r.id} name={r.name} /></span></td>
                <td className="px-3 py-2 text-muted">{r.city}</td>
                <td className="px-3 py-2 text-muted">{r.type}</td>
                <td className="px-3 py-2 text-right">{r.latest?.toLocaleString() ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {r.change5 === null ? "—" : `${r.change5 > 0 ? "+" : r.change5 < 0 ? "\u2212" : ""}${Math.abs(r.change5 * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-2"><Sparkline values={r.spark} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
