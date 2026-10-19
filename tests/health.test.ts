import { describe, expect, it } from "vitest";
import { getSchools } from "../lib/data";
import { FINANCIAL, VITALITY, healthOf, quadrantOf, subScore, tierOf } from "../lib/health";
import { schoolMetrics, type SchoolMetrics } from "../lib/metrics";
import { RULES, SEVERITY_ORDER, alertsFor } from "../lib/radar";
import { demoView, rankUrgent, realView } from "../lib/system";

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

describe("healthOf: real schools get Enrollment Vitality only", () => {
  const ids = getSchools().map((s) => s.id);

  it("Enrollment Vitality is REAL for every parish school", () => {
    for (const id of ids) {
      const v = healthOf(schoolMetrics(id)).vitality;
      expect(v.provenance).toBe("REAL");
      expect(v.factors.filter((f) => f.sub !== null).every((f) => f.provenance === "REAL")).toBe(true);
    }
  });

  it("no composite, financial, facilities score or quadrant for a real school, so it can't show two bands", () => {
    for (const id of ids) {
      const h = healthOf(schoolMetrics(id));
      expect(h.composite).toBeNull();
      expect(h.financial).toBeNull();
      expect(h.facilities).toBeNull();
      expect(h.quadrant).toBeNull();
    }
  });

  it("capacity is skipped and the remaining weights re-normalize to 1", () => {
    const h = healthOf(schoolMetrics(ids[0]));
    expect(h.vitality.skipped).toContain("Capacity utilization");
    const total = h.vitality.factors.reduce((a, f) => a + f.effectiveWeight, 0);
    expect(total).toBeCloseTo(1, 6);
  });
});

describe("healthOf: demo schools get the full composite", () => {
  const ids = getSchools("demo").map((s) => s.id);

  it("every demo school gets scores in 0-100", () => {
    for (const id of ids) {
      const h = healthOf(schoolMetrics(id));
      for (const s of [h.vitality.score, h.financial!.score, h.facilities!.score, h.composite!.score]) {
        expect(s).not.toBeNull();
        expect(s!).toBeGreaterThanOrEqual(0);
        expect(s!).toBeLessThanOrEqual(100);
      }
      expect(h.composite!.provenance).toBe("SAMPLE");
    }
  });

  it("simulated FCI stays in 8-45%, so a Facilities score of 100 can't happen", () => {
    for (const id of ids) {
      const m = schoolMetrics(id);
      expect(m.facilities.fci!).toBeGreaterThanOrEqual(0.075);
      expect(m.facilities.fci!).toBeLessThanOrEqual(0.455);
      expect(healthOf(m).facilities!.score!).toBeLessThan(100);
    }
  });

  it("missing inputs are skipped, not treated as zero", () => {
    const m = structuredClone(schoolMetrics(ids[0])) as SchoolMetrics;
    m.finance.daysCash = null;
    const h = healthOf(m);
    expect(h.financial!.skipped).toContain("Days cash on hand");
    expect(h.financial!.score).not.toBeNull();
  });

  it("top factors are the ones losing the most points", () => {
    const drags = healthOf(schoolMetrics(ids[0])).composite!.topFactors.map((f) => f.drag);
    expect(drags).toEqual([...drags].sort((a, b) => b - a));
  });
});

describe("radar rules", () => {
  it("each rule fires on a constructed bad case and stays quiet on a healthy one", () => {
    const base = structuredClone(schoolMetrics(getSchools("demo")[0].id)) as SchoolMetrics;
    const healthy = structuredClone(base);
    Object.assign(healthy.enrollment, { change1: 0.02, cagr: 0.01, consecutiveDeclines: 0, thinGrades: [] });
    Object.assign(healthy.reenrollment, { rate: 0.95 });
    Object.assign(healthy.pipeline, { inquiryPacing: 0.05 });
    Object.assign(healthy.finance, { operatingMargin: 0.03, daysCash: 120, expenseVarianceYtd: 0, receivables60PlusPct: 0.01, taDependency: 0.1 });
    Object.assign(healthy.facilities, { lifeSafetyOpen: [], fci: 0.1, overdueInspections: 0 });
    Object.assign(healthy.systems, { staleFeeds: [], feeds: healthy.systems.feeds.map((f) => ({ ...f, completenessPct: 99 })) });
    expect(alertsFor(healthy)).toHaveLength(0);

    const bad = structuredClone(healthy);
    Object.assign(bad.enrollment, { change1: -0.13, cagr: -0.07, consecutiveDeclines: 5, thinGrades: [{ grade: "7", count: 10 }] });
    bad.finance.daysCash = 10;
    bad.facilities.lifeSafetyOpen = [{ asset: "Fire alarm system", condition: 1 }, { asset: "Access control & cameras", condition: 2 }];
    const a = alertsFor(bad);
    expect(a.filter((x) => x.severity === "critical").length).toBeGreaterThanOrEqual(4);
    expect(a[0].severity).toBe("critical");
  });

  it("serious needs both 3+ straight declines and a trend at or below the serious line", () => {
    const m = structuredClone(schoolMetrics(getSchools("demo")[0].id)) as SchoolMetrics;
    Object.assign(m.enrollment, { change1: -0.01, cagr: -0.05, consecutiveDeclines: 3, thinGrades: [] });
    expect(alertsFor(m).find((a) => a.area === "Enrollment")!.severity).toBe("serious");
    Object.assign(m.enrollment, { cagr: -0.02 });
    expect(alertsFor(m).find((a) => a.area === "Enrollment")!.severity).toBe("warning");
  });

  it("the Radar headline names 6 or fewer real schools with critical or serious items", () => {
    const urgent = rankUrgent(realView());
    expect(urgent.length).toBeGreaterThan(0);
    expect(urgent.length).toBeLessThanOrEqual(6);
    // ranked by severity, then by the size of the decline
    const sev = urgent.map((v) => SEVERITY_ORDER[v.alerts[0].severity]);
    expect(sev).toEqual([...sev].sort((a, b) => a - b));
  });

  it("real schools get only REAL alerts, and no alert quotes a projected figure", () => {
    for (const v of realView()) for (const a of v.alerts) {
      expect(a.provenance).toBe("REAL");
      expect(a.area).toBe("Enrollment");
      expect(`${a.title} ${a.detail}`).not.toMatch(/project|scenario|forecast|2029-30/i);
    }
    for (const v of demoView()) for (const a of v.alerts) expect(`${a.title} ${a.detail}`).not.toMatch(/project|scenario/i);
  });

  it("every rule has a description shown to users", () => {
    for (const r of RULES) expect(r.description.length).toBeGreaterThan(10);
  });
});
