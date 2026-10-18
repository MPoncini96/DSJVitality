import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  anonymousLabels, clearCache, consecutiveDeclines, enrollmentTotals, getBudget, getCash, getDataAudit, getDemographics,
  getEnrollment, getFacilities, getPipeline, getReceivables, getReenrollment, getSchools, getTuition, getTuitionAssistance,
  getTurnaround, getTurnaroundActions, median, provenanceOf, systemTrend,
} from "../lib/data";
import { Rng } from "../lib/rng";

const DATA = join(__dirname, "..", "data");

afterEach(() => {
  delete process.env.VITALITY_DATA_DIR;
  clearCache();
});

describe("schools", () => {
  it("default view is the 25 parish elementary schools; all = 33", () => {
    expect(getSchools()).toHaveLength(25);
    expect(getSchools("all")).toHaveLength(33);
    expect(getSchools().every((s) => s.governance === "parish_elementary")).toBe(true);
  });

  it("every school is geocoded, cited, and has a 5-digit ZIP", () => {
    for (const s of getSchools("all")) {
      expect(Number.isFinite(s.lat) && Number.isFinite(s.lng)).toBe(true);
      expect(s.lat).toBeGreaterThan(36.9);
      expect(s.lat).toBeLessThan(37.5);
      expect(s.sourceUrl).toBe("https://www.dsj.org/find-a-school/");
      expect(s.zip).toMatch(/^\d{5}$/);
    }
  });

  it("the one ZIP missing from the directory is marked as geocoder-filled", () => {
    const filled = getSchools("all").filter((s) => s.zipSource === "geocoder");
    expect(filled.map((s) => s.id)).toEqual(["st-mary-los-gatos"]);
  });
});

describe("provenance", () => {
  const datasets = {
    getEnrollment, getTuition, getBudget, getTuitionAssistance, getPipeline, getFacilities, getDataAudit, getDemographics,
    getReenrollment, getCash, getReceivables, getTurnaround, getTurnaroundActions,
  };
  for (const [name, fn] of Object.entries(datasets)) {
    it(`${name}: every row is tagged REAL or SAMPLE and covers known schools`, () => {
      const rows = fn() as { provenance: string; schoolId?: string }[];
      expect(rows.length).toBeGreaterThan(0);
      const ids = new Set(getSchools("all").map((s) => s.id));
      for (const r of rows) {
        expect(["REAL", "SAMPLE"]).toContain(r.provenance);
        if (r.schoolId) expect(ids.has(r.schoolId)).toBe(true);
      }
    });
  }

  it("provenanceOf: REAL only when every row is REAL", () => {
    expect(provenanceOf([{ provenance: "REAL" }])).toBe("REAL");
    expect(provenanceOf([{ provenance: "SAMPLE" }])).toBe("SAMPLE");
    expect(provenanceOf([{ provenance: "REAL" }, { provenance: "SAMPLE" }])).toBe("MIXED");
    expect(provenanceOf([])).toBe("SAMPLE");
  });

  it("a REAL row in data/<name>.csv replaces the matching SAMPLE row (and REAL enrollment replaces a school's whole SAMPLE series)", () => {
    const dir = mkdtempSync(join(tmpdir(), "vitality-"));
    mkdirSync(join(dir, "sample"));
    writeFileSync(join(dir, "schools.csv"), readFileSync(join(DATA, "schools.csv")));
    writeFileSync(
      join(dir, "sample", "enrollment.csv"),
      "school_id,year,grade,count,provenance,source\nst-victor,2025,K,10,SAMPLE,gen\nst-victor,2025,1,12,SAMPLE,gen\n"
    );
    writeFileSync(join(dir, "enrollment.csv"), "school_id,year,grade,count,provenance,source\nst-victor,2025,K,31,REAL,CDE\n");
    process.env.VITALITY_DATA_DIR = dir;
    clearCache();
    const rows = getEnrollment();
    expect(rows.find((r) => r.grade === "K")).toMatchObject({ count: 31, provenance: "REAL" });
    // Enrollment is grouped by school: once a school has any REAL rows, its SAMPLE rows
    // are dropped entirely, so the simulated grade 1 does not get stitched onto real data.
    const [total] = enrollmentTotals(["st-victor"]);
    expect(total).toMatchObject({ total: 31, provenance: "REAL" });
    expect(rows.find((r) => r.grade === "1")).toBeUndefined();
  });

  it("rejects a REAL tag inside data/sample/", () => {
    const dir = mkdtempSync(join(tmpdir(), "vitality-"));
    mkdirSync(join(dir, "sample"));
    writeFileSync(join(dir, "sample", "tuition.csv"), "school_id,year,tuition,provenance,source_url\nst-victor,2025,1,REAL,x\n");
    process.env.VITALITY_DATA_DIR = dir;
    clearCache();
    expect(() => getTuition()).toThrow(/only SAMPLE rows/);
  });
});

describe("REAL enrollment", () => {
  it("all 25 parish schools have REAL enrollment and no SAMPLE rows mixed into their series", () => {
    const rows = getEnrollment();
    for (const s of getSchools()) {
      const mine = rows.filter((r) => r.schoolId === s.id);
      expect(mine.length).toBeGreaterThan(0);
      expect(mine.every((r) => r.provenance === "REAL")).toBe(true);
    }
  });
  it("schools without REAL data keep their SAMPLE series", () => {
    const rows = getEnrollment().filter((r) => r.schoolId === "archbishop-mitty");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.provenance === "SAMPLE")).toBe(true);
  });
  it("spot-check against the source file: Holy Family 2025-26 total is 218", () => {
    const t = enrollmentTotals(["holy-family"]).find((x) => x.year === 2025)!;
    expect(t).toMatchObject({ total: 218, provenance: "REAL" });
  });
});

describe("derived metrics", () => {
  it("systemTrend for the default view is the REAL CDE years 2019-20..2025-26", () => {
    const t = systemTrend(getSchools().map((s) => s.id));
    expect(t.map((x) => x.year)).toEqual([2019, 2020, 2021, 2022, 2023, 2024, 2025]);
    expect(t.every((x) => x.provenance === "REAL")).toBe(true);
    // St. Joseph of Cupertino is missing 2022-23 in the CDE file and is carried forward
    expect(t.find((x) => x.year === 2022)!.carriedForward).toEqual(["st-joseph-cupertino"]);
  });

  it("system totals match the CDE grade sums", () => {
    const t = systemTrend(getSchools().map((s) => s.id));
    expect(t.find((x) => x.year === 2025)!.total).toBe(
      getEnrollment().filter((r) => r.year === 2025 && getSchools().some((s) => s.id === r.schoolId)).reduce((a, r) => a + r.count, 0)
    );
  });

  it("consecutiveDeclines counts the trailing run only", () => {
    const s = (vals: number[]) => vals.map((total, i) => ({ year: 2016 + i, total }));
    expect(consecutiveDeclines(s([100, 90, 95, 94, 93, 92]))).toBe(3);
    expect(consecutiveDeclines(s([100, 110]))).toBe(0);
  });

  it("median handles odd, even, and empty", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });

  it("anonymous labels are unique and not in alphabetical order of names", () => {
    const schools = getSchools("all");
    const labels = anonymousLabels(schools);
    expect(new Set(Object.values(labels)).size).toBe(schools.length);
    const alpha = [...schools].sort((a, b) => a.name.localeCompare(b.name)).map((s) => labels[s.id]);
    expect(alpha).not.toEqual([...alpha].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
  });

  it("seeded RNG is deterministic", () => {
    const a = new Rng(42), b = new Rng(42);
    expect([a.float(), a.float(), a.float()]).toEqual([b.float(), b.float(), b.float()]);
  });
});

describe("anonymous labels", () => {
  it("parish elementary schools get contiguous letters A..Y", () => {
    const labels = anonymousLabels(getSchools("all"));
    const parish = getSchools().map((s) => labels[s.id].replace("School ", "")).sort();
    expect(parish).toEqual("ABCDEFGHIJKLMNOPQRSTUVWXY".split(""));
  });
});
