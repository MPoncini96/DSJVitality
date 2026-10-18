import { describe, expect, it } from "vitest";
import { getSchools } from "../lib/data";
import { FINANCIAL, VITALITY, healthOf, quadrantOf, subScore, tierOf } from "../lib/health";
import { schoolMetrics, type SchoolMetrics } from "../lib/metrics";
import { RULES, alertsFor } from "../lib/radar";

describe("subScore", () => {
  it("interpolates between concern (0) and healthy (100) and clamps", () => {
    expect(subScore(-0.05, -0.05, 0.02)).toBe(0);
    expect(subScore(0.02, -0.05, 0.02)).toBe(100);
    expect(subScore(-0.015, -0.05, 0.02)).toBe(50);
    expect(subScore(-0.5, -0.05, 0.02)).toBe(0);
    expect(subScore(0.5, -0.05, 0.02)).toBe(100);
  });
  it("works when lower is healthier (reversed thresholds)", () => {
    expect(subScore(0.25, 0.25, 0.08)).toBe(0);
    expect(subScore(0.08, 0.25, 0.08)).toBe(100);
  });
});

describe("tiers and quadrants", () => {
  it("tiers follow the documented cut points", () => {
    expect(tierOf(70)).toBe("Stable");
    expect(tierOf(69)).toBe("Watch");
    expect(tierOf(50)).toBe("Watch");
    expect(tierOf(49)).toBe("Turnaround candidate");
    expect(tierOf(null)).toBeNull();
  });
  it("quadrants split at 0% CAGR and a financial score of 50", () => {
    expect(quadrantOf(0.01, 80)).toBe("Stable");
    expect(quadrantOf(0.01, 20)).toBe("Growth opportunity");
    expect(quadrantOf(-0.01, 80)).toBe("Watch");
    expect(quadrantOf(-0.01, 20)).toBe("Turnaround candidate");
  });
  it("weights in each score add to 100", () => {
    expect(VITALITY.reduce((a, f) => a + f.weight, 0)).toBe(100);
    expect(FINANCIAL.reduce((a, f) => a + f.weight, 0)).toBe(100);
  });
});

describe("healthOf on real metrics objects", () => {
  const ids = getSchools().map((s) => s.id);

  it("Enrollment Vitality is REAL for every parish school and skips SAMPLE inputs", () => {
    for (const id of ids) {
      const v = healthOf(schoolMetrics(id)).vitality;
      expect(v.provenance).toBe("REAL");
      expect(v.factors.filter((f) => f.sub !== null).every((f) => f.provenance === "REAL")).toBe(true);
    }
  });

  it("every parish school gets scores in 0-100, and SAMPLE inputs make the composite non-REAL", () => {
    for (const id of ids) {
      const h = healthOf(schoolMetrics(id));
      for (const s of [h.vitality.score, h.financial.score, h.facilities.score, h.composite.score]) {
        expect(s).not.toBeNull();
        expect(s!).toBeGreaterThanOrEqual(0);
        expect(s!).toBeLessThanOrEqual(100);
      }
      expect(h.composite.provenance).not.toBe("REAL");
    }
  });

  it("capacity is skipped and the remaining weights re-normalize to 1", () => {
    const h = healthOf(schoolMetrics(ids[0]));
    expect(h.vitality.skipped).toContain("Capacity utilization");
    const total = h.vitality.factors.reduce((a, f) => a + f.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 6);
  });

  it("missing inputs are skipped, not treated as zero", () => {
    const m = structuredClone(schoolMetrics(ids[0])) as SchoolMetrics;
    m.finance.daysCash = null;
    const h = healthOf(m);
    expect(h.financial.skipped).toContain("Days cash on hand");
    expect(h.financial.score).not.toBeNull();
  });

  it("top factors are the ones losing the most points", () => {
    const h = healthOf(schoolMetrics(ids[0]));
    const drags = h.composite.topFactors.map((f) => f.drag);
    expect(drags).toEqual([...drags].sort((a, b) => b - a));
  });
});

describe("radar rules", () => {
  it("each rule fires on a constructed bad case and stays quiet on a healthy one", () => {
    const base = structuredClone(schoolMetrics(getSchools()[0].id)) as SchoolMetrics;
    const healthy = structuredClone(base);
    Object.assign(healthy.enrollment, { change1: 0.02, consecutiveDeclines: 0, thinGrades: [] });
    Object.assign(healthy.reenrollment, { rate: 0.95 });
    Object.assign(healthy.pipeline, { inquiryPacing: 0.05 });
    Object.assign(healthy.finance, { operatingMargin: 0.03, daysCash: 120, expenseVarianceYtd: 0, receivables60PlusPct: 0.01, taDependency: 0.1 });
    Object.assign(healthy.facilities, { lifeSafetyOpen: [], fci: 0.1, overdueInspections: 0 });
    Object.assign(healthy.systems, { staleFeeds: [], feeds: healthy.systems.feeds.map((f) => ({ ...f, completenessPct: 99 })) });
    expect(alertsFor(healthy)).toHaveLength(0);

    const bad = structuredClone(healthy);
    Object.assign(bad.enrollment, { change1: -0.1, consecutiveDeclines: 5, thinGrades: [{ grade: "7", count: 10 }] });
    bad.finance.daysCash = 10;
    bad.facilities.lifeSafetyOpen = [{ asset: "Fire alarm system", condition: 1 }, { asset: "Access control & cameras", condition: 2 }];
    const a = alertsFor(bad);
    expect(a.filter((x) => x.severity === "critical").length).toBeGreaterThanOrEqual(4);
    expect(a[0].severity).toBe("critical");
  });

  it("every rule has a description shown to users", () => {
    for (const r of RULES) expect(r.description.length).toBeGreaterThan(10);
  });
});
