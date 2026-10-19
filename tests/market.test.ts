import { describe, expect, it } from "vitest";
import { getBirths, getCountyBirths, getSchools, getTuition, getTuitionUnverified } from "../lib/data";
import { healthOf, VITALITY } from "../lib/health";
import { schoolMetrics } from "../lib/metrics";

const parish = () => getSchools().map((s) => s.id);

describe("births (CDPH)", () => {
  it("every parish school has 20 REAL birth years, 2005-2024, and its home ZIP in its catchment", () => {
    for (const id of parish()) {
      const rows = getBirths().filter((r) => r.schoolId === id);
      expect(rows.map((r) => r.birthYear).sort()).toEqual(Array.from({ length: 20 }, (_, i) => 2005 + i));
      expect(rows.every((r) => r.provenance === "REAL")).toBe(true);
      const zip = getSchools().find((s) => s.id === id)!.zip;
      expect(rows[0].catchmentZips).toContain(zip);
    }
  });
  it("county totals load (2024: 19,093)", () => {
    expect(getCountyBirths().find((c) => c.birthYear === 2024)!.births).toBe(19093);
  });
});

describe("kindergarten share and projection", () => {
  it("share = kindergarten / births five years earlier (Holy Family 2025-26: 18 / 3,702)", () => {
    const k = schoolMetrics("holy-family").market.kShare.find((x) => x.year === 2025)!;
    expect(k).toMatchObject({ k: 18, births: 3702 });
    expect(k.share).toBeCloseTo(18 / 3702, 10);
  });
  it("scenarios run 2026-27 through 2029-30 as a low-high range from REAL inputs", () => {
    const sc = schoolMetrics("holy-family").scenario;
    expect(sc.years.map((y) => y.year)).toEqual([2026, 2027, 2028, 2029]);
    expect(sc.inputs).toBe("REAL");
    for (const y of sc.years) {
      expect(y.low).toBeLessThanOrEqual(y.high);
      expect(y.low).toBe(Math.min(y.trend, y.births));
      expect(y.high).toBe(Math.max(y.trend, y.births));
    }
  });
  it("the trend scenario uses the capped CAGR since 2019-20, not a single year", () => {
    // St. Lawrence: -19%/yr since 2019-20 and -17% last year; the scenario caps the trend at -6%/yr
    const m = schoolMetrics("st-lawrence");
    expect(m.enrollment.cagr!).toBeLessThan(-0.06);
    expect(m.scenario.trendRate).toBe(-0.06);
    expect(m.scenario.years[0].trend).toBe(Math.round(m.enrollment.latest! * 0.94));
  });
  it("trend since 2019-20 spans six school years (Holy Family 281 -> 218)", () => {
    const e = schoolMetrics("holy-family").enrollment;
    expect(e.baseYear).toBe(2019);
    expect(e.changeSinceBase).toBeCloseTo(218 / 281 - 1, 10);
    expect(e.cagr).toBeCloseTo((218 / 281) ** (1 / 6) - 1, 10);
  });
  it("Enrollment Vitality uses births and kindergarten share, not population or entry trend", () => {
    const keys = VITALITY.map((f) => f.key);
    expect(keys).toContain("births5Change");
    expect(keys).toContain("kShareTrend");
    expect(keys).not.toContain("pop5to14Change5");
    expect(keys).not.toContain("entryTrend3");
    for (const id of parish()) {
      const v = healthOf(schoolMetrics(id)).vitality;
      expect(v.skipped).toEqual(["Capacity utilization"]);
      expect(v.provenance).toBe("REAL");
    }
  });
});

describe("tuition", () => {
  it("REAL tuition comes only from schools' own pages; unverified listings are kept apart", () => {
    const real = getTuition().filter((t) => t.provenance === "REAL");
    const unverified = getTuitionUnverified().map((u) => u.schoolId).sort();
    expect(unverified).toEqual(["st-joseph-cupertino", "st-justin", "st-martin-of-tours", "st-mary-gilroy"]);
    for (const id of unverified) expect(real.some((t) => t.schoolId === id)).toBe(false);
  });
  it("real schools never get simulated tuition; unpublished stays blank", () => {
    for (const id of parish()) expect(getTuition().some((t) => t.schoolId === id && t.provenance === "SAMPLE")).toBe(false);
    for (const id of ["holy-family", "holy-spirit", "st-christopher", "st-elizabeth-seton"]) {
      expect(getTuition().some((t) => t.schoolId === id)).toBe(false);
      expect(schoolMetrics(id).finance.tuitionLatest).toBeNull();
    }
  });
  it("a prior-year rate quoted on the page becomes a REAL row (St. John Vianney 2025-26: $13,900)", () => {
    const rows = getTuition().filter((t) => t.schoolId === "st-john-vianney").sort((a, b) => a.year - b.year);
    expect(rows.map((r) => [r.year, r.tuition])).toEqual([[2025, 13900], [2026, 15100]]);
  });
  it("undated school pages are REAL but flagged", () => {
    const t = getTuition().find((r) => r.schoolId === "st-lawrence")!;
    expect(t).toMatchObject({ provenance: "REAL", yearStated: false, year: 2025 });
  });
});

describe("strategies", () => {
  it("bright spots and patterns come from REAL data only, and sources resolve", async () => {
    const { BRIGHT_SPOTS, PATTERNS, LEVERS, SOURCES } = await import("../lib/strategies");
    const ids = new Set(SOURCES.map((s) => s.id));
    for (const l of LEVERS) for (const s of l.strategies) for (const id of s.sources) expect(ids.has(id)).toBe(true);
    for (const p of PATTERNS) for (const k of p.levers) expect(LEVERS.some((l) => l.key === k)).toBe(true);
    const holding = parish().filter((id) => BRIGHT_SPOTS[0].test(schoolMetrics(id))).sort();
    expect(holding).toEqual(["st-john-the-baptist", "st-leo", "st-simon", "st-victor"]);
    for (const id of parish()) {
      const m = schoolMetrics(id);
      expect(m.enrollment.provenance).toBe("REAL");
      expect(m.market.provenance).toBe("REAL");
    }
  });
});
