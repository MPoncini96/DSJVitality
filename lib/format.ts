const MINUS = "−";

export const signedPct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v > 0 ? "+" : v < 0 ? MINUS : ""}${Math.abs(v * 100).toFixed(digits)}%`;

export const pct = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(digits)}%`;

export const money = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : `${v < 0 ? MINUS : ""}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

export const moneyShort = (v: number | null | undefined) => {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`;
  return v < 0 ? MINUS + s : s;
};

export const num = (v: number | null | undefined) =>
  v === null || v === undefined || !Number.isFinite(v) ? "—" : Math.round(v).toLocaleString("en-US");

export const dateLong = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export const dateShort = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export const schoolYear = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;

export const dateMed = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
