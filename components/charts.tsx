"use client";

import { useRouter } from "next/navigation";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer,
  Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
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
  x: number; // enrollment CAGR since the base year, as a fraction
  y: number; // financial score 0-100
  quadrant: Quadrant;
}

/** X-axis range: the data plus 2 points of padding, but never wider than this. */
const X_LIMIT: [number, number] = [-12, 10];

/**
 * Enrollment & Finance Matrix for the demo schools. Click a dot to open the school.
 * Dots in the turnaround quadrant are labeled; the rest show their name on hover and
 * in the table below. A school beyond the axis limits is drawn at the edge as an arrow.
 */
export function MatrixChart({ points, height = 400, baseLabel }: { points: MatrixPoint[]; height?: number; baseLabel: string }) {
  const router = useRouter();
  const xs = points.map((p) => p.x * 100);
  const lo = Math.max(X_LIMIT[0], Math.floor(Math.min(0, ...xs) - 2));
  const hi = Math.min(X_LIMIT[1], Math.ceil(Math.max(0, ...xs) + 2));
  const data = points.map((p) => {
    const xPct = p.x * 100;
    const clipped = xPct < lo ? -1 : xPct > hi ? 1 : 0;
    return { ...p, xPct, xPlot: Math.min(hi, Math.max(lo, xPct)), clipped, label: p.quadrant === "Turnaround candidate" ? p.name.replace("School ", "") : "" };
  });
  const step = hi - lo > 12 ? 4 : 2;
  const xTicks: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) xTicks.push(t);
  const Dot = (props: { cx?: number; cy?: number; payload?: (typeof data)[number] }) => {
    const { cx = 0, cy = 0, payload } = props;
    if (!payload) return <g />;
    const fill = QCOLOR[payload.quadrant];
    return (
      <g style={{ cursor: "pointer" }}>
        {payload.clipped ? (
          <path d={payload.clipped < 0 ? `M ${cx - 8} ${cy} L ${cx + 4} ${cy - 7} L ${cx + 4} ${cy + 7} Z` : `M ${cx + 8} ${cy} L ${cx - 4} ${cy - 7} L ${cx - 4} ${cy + 7} Z`}
            fill={fill} stroke="var(--surface)" strokeWidth={1.5} />
        ) : (
          <circle cx={cx} cy={cy} r={7} fill={fill} stroke="var(--surface)" strokeWidth={2} />
        )}
        {payload.label && (
          <text x={cx + 10} y={cy + 4} fontSize={11} fontWeight={600} fill="var(--text)">{payload.label}</text>
        )}
      </g>
    );
  };
  return (
    <figure>
      <div style={{ height }} className="relative" role="img" aria-label={`Scatter plot of ${points.length} demo schools by enrollment trend since ${baseLabel} and financial score, in four quadrants`}>
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 text-[11px] font-semibold text-muted">
          <span className="absolute left-[52px] top-5">Watch</span>
          <span className="absolute right-5 top-5">Stable</span>
          <span className="absolute bottom-[58px] left-[52px]">Turnaround candidate</span>
          <span className="absolute bottom-[58px] right-5">Growth opportunity</span>
        </div>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 16, right: 24, bottom: 24, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" />
            <ReferenceArea x1={lo} x2={0} y1={0} y2={50} fill="var(--critical)" fillOpacity={0.05} stroke="none" />
            <ReferenceArea x1={lo} x2={0} y1={50} y2={100} fill="var(--warning)" fillOpacity={0.05} stroke="none" />
            <ReferenceArea x1={0} x2={hi} y1={0} y2={50} fill="var(--series-1)" fillOpacity={0.05} stroke="none" />
            <ReferenceArea x1={0} x2={hi} y1={50} y2={100} fill="var(--good)" fillOpacity={0.05} stroke="none" />
            <ReferenceLine x={0} stroke="var(--muted)" />
            <ReferenceLine y={50} stroke="var(--muted)" />
            <XAxis type="number" dataKey="xPlot" domain={[lo, hi]} ticks={xTicks} tick={axisTick} tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
              label={{ value: `Enrollment trend since ${baseLabel} (% a year)`, position: "bottom", offset: 8, fill: "var(--muted)", fontSize: 11 }} />
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
                    <div style={{ fontWeight: 600 }}>{d.name}</div>
                    <div>{d.quadrant}</div>
                    <div style={{ color: "var(--muted)" }}>
                      Trend {d.xPct > 0 ? "+" : ""}{d.xPct.toFixed(1)}%/yr{d.clipped ? " (off the axis)" : ""} · Financial {d.y}
                    </div>
                    <div style={{ color: "var(--muted)" }}>Click to open</div>
                  </div>
                );
              }}
            />
            <Scatter
              data={data}
              isAnimationActive={false}
              shape={Dot}
              onClick={(e) => {
                const d = (e as unknown as { payload?: (typeof data)[number] }).payload;
                if (d) router.push(`/demo/schools/${d.id}`);
              }}
            >
              {data.map((d) => <Cell key={d.id} fill={QCOLOR[d.quadrant]} />)}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">View as table</summary>
        <div className="relative overflow-x-auto">
          <table className="mt-2 tabular">
            <thead>
              <tr><th className="pr-6 text-left font-medium">School</th><th className="pr-6 text-right font-medium">Trend</th><th className="pr-6 text-right font-medium">Financial</th><th className="text-left font-medium">Quadrant</th></tr>
            </thead>
            <tbody>
              {[...data].sort((a, b) => a.y - b.y).map((d) => (
                <tr key={d.id}>
                  <td className="pr-6"><a href={`/demo/schools/${d.id}`} className="underline underline-offset-2">{d.name}</a></td>
                  <td className="pr-6 text-right">{d.xPct > 0 ? "+" : ""}{d.xPct.toFixed(1)}%</td><td className="pr-6 text-right">{d.y}</td><td>{d.quadrant}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(y) => `School year ${sy(Number(y))}${sample ? " (simulated)" : ""}`} cursor={{ fill: "var(--surface-2)" }} />
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
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} formatter={(v) => [fmt(Number(v)) + (sample ? " (simulated)" : ""), label]} />
          <Bar dataKey={yKey} fill={sample ? "var(--sample-mark)" : "var(--accent)"} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Small single-series line with its own formatter (tuition, rates, population). */
export function SimpleLine({
  rows, format, label, sample,
}: { rows: { x: string; y: number }[]; format: "money" | "pct" | "pct2" | "number"; label: string; sample: boolean }) {
  const fmt = (v: number) =>
    format === "money" ? `$${Math.round(v).toLocaleString()}` : format === "pct" ? `${(v * 100).toFixed(0)}%` : format === "pct2" ? `${(v * 100).toFixed(2)}%` : Math.round(v).toLocaleString();
  const ticks = niceTicks(rows.map((r) => r.y), 4);
  const stroke = sample ? "var(--sample-mark)" : "var(--accent)";
  return (
    <div className="h-48" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="x" tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={56} tickFormatter={fmt}
            domain={format.startsWith("pct") ? ["auto", "auto"] : [ticks[0], ticks.at(-1)!]} ticks={format.startsWith("pct") ? undefined : ticks} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [fmt(Number(v)) + (sample ? " (simulated)" : ""), label]} />
          <Line dataKey="y" stroke={stroke} strokeWidth={2} strokeDasharray={sample ? "6 4" : undefined} dot={{ r: 3, fill: stroke, strokeWidth: 0 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Actual enrollment (solid line), then a shaded scenario range (low to high). No
 * single projected line is drawn, on purpose.
 */
export function ScenarioChart({
  actual, range, label,
}: { actual: { year: number; total: number }[]; range: { year: number; low: number; high: number }[]; label: string }) {
  const last = actual.at(-1);
  const rows = [
    ...actual.map((a) => ({ year: a.year, actual: a.total, range: a.year === last?.year ? [a.total, a.total] : undefined })),
    ...range.map((p) => ({ year: p.year, actual: undefined, range: [p.low, p.high] })),
  ];
  const ticks = niceTicks([...actual.map((r) => r.total), ...range.flatMap((r) => [r.low, r.high])]);
  return (
    <div className="h-64" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="year" tickFormatter={sy} tick={axisTick} tickLine={false} axisLine={{ stroke: "var(--border)" }} />
          <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} domain={[ticks[0], ticks.at(-1)!]} ticks={ticks} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={(y) => `School year ${sy(Number(y))}`}
            formatter={(v, name) => [Array.isArray(v) ? `${Number(v[0]).toLocaleString()}–${Number(v[1]).toLocaleString()}` : Number(v).toLocaleString(), name === "range" ? "Scenario range" : "Actual"]} />
          <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} formatter={(v) => (v === "range" ? "Scenario range (not a forecast)" : "Actual")} />
          {last && <ReferenceLine x={last.year} stroke="var(--muted)" strokeDasharray="2 3" />}
          <Area dataKey="range" stroke="var(--accent)" strokeDasharray="4 3" fill="var(--accent)" fillOpacity={0.15} isAnimationActive={false} connectNulls={false} />
          <Line dataKey="actual" stroke="var(--accent)" strokeWidth={2} dot={{ r: 3, fill: "var(--accent)", strokeWidth: 0 }} isAnimationActive={false} connectNulls={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
