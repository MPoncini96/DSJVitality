"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MixedProvenance } from "@/lib/data";

export interface TrendPoint {
  year: number;
  total: number;
  provenance: MixedProvenance;
}

const schoolYear = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;

/** Round axis ticks (steps of 1, 2 or 5 x 10^k), not anchored at zero, so a trend is readable. */
export function niceTicks(values: number[], target = 5): number[] {
  if (values.length === 0) return [0, 1];
  let lo = Math.min(...values), hi = Math.max(...values);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.15;
  lo -= pad; hi += pad;
  const raw = (hi - lo) / (target - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((x) => x >= raw)!;
  const out: number[] = [];
  for (let v = Math.floor(lo / step) * step; v <= Math.ceil(hi / step) * step + 1e-9; v += step) out.push(Math.max(0, v));
  return [...new Set(out)];
}

/**
 * Single-series trend line. SAMPLE data draws dashed in amber; REAL draws solid in the accent.
 */
export function TrendChart({ data, label }: { data: TrendPoint[]; label: string }) {
  const ticks = niceTicks(data.map((d) => d.total));
  const sample = data.some((d) => d.provenance !== "REAL");
  const stroke = sample ? "var(--sample-mark)" : "var(--accent)";
  return (
    <figure>
      <div className="h-64 w-full" role="img" aria-label={`${label}, ${schoolYear(data[0]?.year)} to ${schoolYear(data.at(-1)?.year ?? 0)}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis
              dataKey="year"
              tickFormatter={schoolYear}
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
              domain={[ticks[0], ticks[ticks.length - 1]]}
              ticks={ticks}
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <Tooltip
              cursor={{ stroke: "var(--faint)", strokeDasharray: "2 3" }}
              contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }}
              labelFormatter={(y) => `School year ${schoolYear(Number(y))}`}
              formatter={(v) => [Number(v).toLocaleString() + (sample ? " (SAMPLE)" : ""), "Students"]}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke={stroke}
              strokeWidth={2}
              strokeDasharray={sample ? "6 4" : undefined}
              dot={{ r: 3, fill: stroke, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "var(--surface)", strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-muted">
        <summary className="cursor-pointer">View as table</summary>
        <table className="mt-2 tabular">
          <thead>
            <tr>
              <th className="pr-6 text-left font-medium">School year</th>
              <th className="text-right font-medium">Students</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.year}>
                <td className="pr-6">{schoolYear(d.year)}</td>
                <td className="text-right">{d.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
