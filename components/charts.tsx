"use client";

import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { useNames } from "./Names";
import type { MixedProvenance } from "@/lib/data";
import type { Quadrant } from "@/lib/health";
import { niceTicks } from "./TrendChart";

const axisTick = { fill: "var(--muted)", fontSize: 11 };
const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" };
const sy = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;

const QCOLOR: Record<Quadrant, string> = {
  Stable: "var(--good)",
  Watch: "var(--warning)",
  "Growth opportunity": "var(--series-1)",
  "Turnaround candidate": "var(--critical)",
};

export interface MatrixPoint {
  id: string;
  name: string;
  x: number; // cagr5 as a fraction
  y: number; // financial score 0-100
  quadrant: Quadrant;
  provenance: MixedProvenance;
}

/**
 * Enrollment & Finance Matrix. Labels are always anonymous when the plot uses SAMPLE
 * inputs; when names are switched on, dots are not clickable (see RiskSchoolRef).
 */
export function MatrixChart({ points, height = 380 }: { points: MatrixPoint[]; height?: number }) {
  const router = useRouter();
  const { anonymize, labels } = useNames();
  const data = points.map((p) => {
    const forced = p.provenance !== "REAL";
    return { ...p, xPct: p.x * 100, label: anonymize || forced ? labels[p.id] : p.name, clickable: anonymize || !forced };
  });
  const maxAbs = Math.max(4, ...data.map((d) => Math.abs(d.xPct)));
  const xr = Math.ceil((maxAbs + 0.5) / 5) * 5;
  const xTicks = Array.from({ length: (2 * xr) / 5 + 1 }, (_, i) => -xr + i * 5);
  return (
    <figure>
      <div style={{ height }} className="relative" role="img" aria-label="Scatter plot of schools by five-year enrollment trend and financial score, divided into four quadrants">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-[11px] font-semibold text-muted">
          <span className="absolute left-[52px] top-5">Watch</span>
          <span className="absolute right-5 top-5">Stable</span>
          <span className="absolute bottom-[58px] left-[52px]">Turnaround candidate</span>
          <span className="absolute bottom-[58px] right-5">Growth opportunity</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 16, bottom: 24, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" />
            <ReferenceArea x1={-xr} x2={0} y1={0} y2={50} fill="var(--critical)" fillOpacity={0.05} stroke="none" />
            <ReferenceArea x1={-xr} x2={0} y1={50} y2={100} fill="var(--warning)" fillOpacity={0.05} stroke="none" />
            <ReferenceArea x1={0} x2={xr} y1={0} y2={50} fill="var(--series-1)" fillOpacity={0.05} stroke="none" />
            <ReferenceArea x1={0} x2={xr} y1={50} y2={100} fill="var(--good)" fillOpacity={0.05} stroke="none" />
            <ReferenceLine x={0} stroke="var(--faint)" />
            <ReferenceLine y={50} stroke="var(--faint)" />
            <XAxis type="number" dataKey="xPct" domain={[-xr, xr]} ticks={xTicks} tick={axisTick} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
              label={{ value: "5-year enrollment trend (CAGR)", position: "bottom", offset: 8, fill: "var(--muted)", fontSize: 11 }} />
            <YAxis type="number" dataKey="y" domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={axisTick} width={40}
              label={{ value: "Financial score", angle: -90, position: "insideLeft", offset: 12, fill: "var(--muted)", fontSize: 11 }} />
            <ZAxis range={[140, 140]} />
            <Tooltip
              cursor={false}
              contentStyle={tooltipStyle}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload as (typeof data)[number];
                return (
                  <div style={{ ...tooltipStyle, padding: "8px 10px" }}>
                    <div style={{ fontWeight: 600 }}>{d.label}</div>
                    <div>{d.quadrant}</div>
                    <div style={{ color: "var(--muted)" }}>
                      Trend {d.xPct > 0 ? "+" : ""}{d.xPct.toFixed(1)}%/yr · Financial {d.y}
                      {d.provenance !== "REAL" ? " · SAMPLE" : ""}
                    </div>
                    {d.clickable && <div style={{ color: "var(--muted)" }}>Click to open</div>}
                  </div>
                );
              }}
            />
            <Scatter
              data={data}
              isAnimationActive={false}
              onClick={(e) => {
                const d = (e as unknown as { payload?: (typeof data)[number] }).payload;
                if (d?.clickable) router.push(`/schools/${d.id}`);
              }}
              style={{ cursor: "pointer" }}
            >
              {data.map((d) => (
                <Cell key={d.id} fill={QCOLOR[d.quadrant]} stroke="var(--surface)" strokeWidth={2} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 tabular">
          <thead>
            <tr><th className="pr-6 text-left font-medium">School</th><th className="pr-6 text-right font-medium">Trend</th><th className="pr-6 text-right font-medium">Financial</th><th className="text-left font-medium">Quadrant</th></tr>
          </thead>
          <tbody>
            {[...data].sort((a, b) => a.y - b.y).map((d) => (
              <tr key={d.id}><td className="pr-6">{d.label}</td><td className="pr-6 text-right">{d.xPct.toFixed(1)}%</td><td className="pr-6 text-right">{d.y}</td><td>{d.quadrant}</td></tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

/** Enrollment by grade band, stacked (K-2, 3-5, 6-8 or 9-12). */
export function GradeBandChart({ rows, sample }: { rows: { year: number; [band: string]: number }[]; sample: boolean }) {
  const bands = Object.keys(rows[0] ?? {}).filter((k) => k !== "year");
  const colors = ["var(--series-1)", "var(--series-2)", "var(--series-3)"];
  return (
    <figure>
      <div className="h-64" role="img" aria-label={`Enrollment by grade band, stacked: ${bands.join(", ")}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="year" tickFormatter={sy} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
            <YAxis tick={axisTick} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(y) => `School year ${sy(Number(y))}${sample ? " (SAMPLE)" : ""}`} cursor={{ fill: "var(--surface-2)" }} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} iconType="square" />
            {bands.map((b, i) => (
              <Bar key={b} dataKey={b} stackId="g" fill={colors[i % 3]} stroke="var(--surface)" strokeWidth={1} isAnimationActive={false}
                fillOpacity={sample ? 0.85 : 1} radius={i === bands.length - 1 ? [3, 3, 0, 0] : 0} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

/** Single-series bars (capital needs by year, receivables aging). */
export function SimpleBars({
  rows, xKey, yKey, format, label, sample,
}: { rows: Record<string, number | string>[]; xKey: string; yKey: string; format: "money" | "number"; label: string; sample: boolean }) {
  const fmt = (v: number) => (format === "money" ? (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`) : v.toLocaleString());
  return (
    <div className="h-56" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey={xKey} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={52} tickFormatter={fmt} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [fmt(Number(v)) + (sample ? " (SAMPLE)" : ""), label]} />
          <Bar dataKey={yKey} fill={sample ? "var(--sample-mark)" : "var(--accent)"} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small single-series line with its own formatter (tuition, rates, population). */
export function SimpleLine({
  rows, format, label, sample,
}: { rows: { x: string; y: number }[]; format: "money" | "pct" | "number"; label: string; sample: boolean }) {
  const fmt = (v: number) => (format === "money" ? `$${Math.round(v).toLocaleString()}` : format === "pct" ? `${(v * 100).toFixed(0)}%` : Math.round(v).toLocaleString());
  const ticks = niceTicks(rows.map((r) => r.y), 4);
  const stroke = sample ? "var(--sample-mark)" : "var(--accent)";
  return (
    <div className="h-48" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="x" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={fmt}
            domain={format === "pct" ? ["auto", "auto"] : [ticks[0], ticks.at(-1)!]} ticks={format === "pct" ? undefined : ticks} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)) + (sample ? " (SAMPLE)" : ""), label]} />
          <Line dataKey="y" stroke={stroke} strokeWidth={2} strokeDasharray={sample ? "6 4" : undefined} dot={{ r: 3, fill: stroke, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
