"use client";

import { useMemo, useState } from "react";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { SchoolLocation, SchoolName, useNames } from "./Names";
import type { MixedProvenance } from "@/lib/data";

export interface SchoolTableRow {
  id: string;
  name: string;
  city: string;
  type: string;
  latest: number | null;
  change5: number | null;
  spark: number[];
  provenance: MixedProvenance;
}

/** "School C" -> 2, "School AA" -> 26, so anonymous labels sort A..Z, AA.. */
function labelIndex(label: string | undefined): number {
  const L = (label ?? "").replace("School ", "");
  return L.length === 1 ? L.charCodeAt(0) - 65 : (L.charCodeAt(0) - 64) * 26 + (L.charCodeAt(1) - 65);
}

type SortKey = "name" | "city" | "type" | "latest" | "change5";

function Sparkline({ values, sample }: { values: number[]; sample: boolean }) {
  if (values.length < 2) return null;
  const w = 72, h = 20;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 2 - ((v - min) / span) * (h - 4)}`).join(" ");
  return (
    <svg width={w} height={h} aria-hidden="true" className="inline-block align-middle">
      <polyline
        points={pts}
        fill="none"
        stroke={sample ? "var(--sample-mark)" : "var(--accent)"}
        strokeWidth={1.5}
        strokeDasharray={sample ? "3 2" : undefined}
      />
    </svg>
  );
}

export function SchoolsTable({ rows }: { rows: SchoolTableRow[] }) {
  const { anonymize, labels } = useNames();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });

  const sorted = useMemo(() => {
    const val = (r: SchoolTableRow) => {
      switch (sort.key) {
        case "name": return anonymize ? labelIndex(labels[r.id]) : r.name;
        case "city": return anonymize ? "" : r.city;
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
  }, [rows, sort, anonymize, labels]);

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
        <caption className="sr-only">Schools with latest enrollment and five-year change. Column headers sort the table.</caption>
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            {header("name", "School")}
            {header("city", "City")}
            {header("type", "Type")}
            {header("latest", "Enrollment 2025-26", "right")}
            {header("change5", "5-yr change", "right")}
            <th scope="col" className="px-3 py-2 text-left font-medium">Trend</th>
            <th scope="col" className="px-3 py-2 text-left font-medium">Data</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const sample = r.provenance !== "REAL";
            return (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2 font-medium"><SchoolName id={r.id} name={r.name} /></td>
                <td className="px-3 py-2 text-muted"><SchoolLocation text={r.city} /></td>
                <td className="px-3 py-2 text-muted">{r.type}</td>
                <td className="px-3 py-2 text-right">{r.latest?.toLocaleString() ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  {r.change5 === null ? "—" : `${r.change5 > 0 ? "+" : r.change5 < 0 ? "\u2212" : ""}${Math.abs(r.change5 * 100).toFixed(1)}%`}
                </td>
                <td className="px-3 py-2"><Sparkline values={r.spark} sample={sample} /></td>
                <td className="px-3 py-2"><ProvenanceBadge p={r.provenance} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
