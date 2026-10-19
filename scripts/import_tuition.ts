/**
 * Import published tuition, keeping confidence levels apart.
 *
 *   input:  data/raw/tuition_published_<date>.json
 *   output: data/tuition.csv             REAL: from the school's own page (dated or undated)
 *           data/tuition_unverified.csv  third-party listings (Niche, PrivateSchoolReview); shown, never used in metrics
 *           data/tuition_review.csv      one row per parish school: what was found and why
 *
 * Rules
 *   - "school"          -> REAL, year as stated
 *   - "school_undated"  -> REAL, year taken from the reviewer's note ("likely 2025-26"), flagged year_stated=no
 *   - "third_party"     -> unverified file only
 *   - "not_found"       -> nothing (blank, never guessed)
 *   - A note like "Up from $13,900 in 2025-26" adds a REAL prior-year row from the same page.
 *
 * Run: npm run data:tuition
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, toCsv } from "../lib/csv";

const root = join(__dirname, "..");
const rawDir = join(root, "data", "raw");
const file = readdirSync(rawDir).filter((f) => /^tuition_published_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
if (!file) throw new Error("No data/raw/tuition_published_<date>.json found.");

type Confidence = "school" | "school_undated" | "third_party" | "not_found";
interface Entry {
  school_year: string | null; catholic_rate: number | null; standard_rate: number | null;
  confidence: Confidence; source_url: string; notes: string;
}
const raw: { retrieved: string; schools: Record<string, Entry> } = JSON.parse(readFileSync(join(rawDir, file), "utf8"));
const schools = new Map(parseCsv(readFileSync(join(root, "data", "schools.csv"), "utf8")).map((s) => [s.id, s]));

const errors: string[] = [];
const startYear = (label: string, where: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m || (Number(m[1]) + 1) % 100 !== Number(m[2])) { errors.push(`${where}: year "${label}" is not like 2026-27`); return 0; }
  return Number(m[1]);
};
const rate = (v: number | null, where: string) => {
  if (v === null) return null;
  if (!Number.isFinite(v) || v < 3000 || v > 60000) errors.push(`${where}: rate ${v} is outside $3,000-$60,000`);
  return v;
};

const real: Record<string, string | number>[] = [];
const unverified: Record<string, string | number>[] = [];
const review: Record<string, string>[] = [];

for (const [id, t] of Object.entries(raw.schools)) {
  if (!schools.has(id)) { errors.push(`${id}: not in data/schools.csv`); continue; }
  const std = rate(t.standard_rate, `${id} standard`);
  const parish = rate(t.catholic_rate, `${id} catholic`);
  if (std !== null && parish !== null && parish > std) errors.push(`${id}: parishioner rate is above the standard rate`);
  let outcome = "";

  if (t.confidence === "school" || t.confidence === "school_undated") {
    if (std === null) errors.push(`${id}: confidence "${t.confidence}" but no standard rate`);
    let y: number;
    let stated = "yes";
    if (t.school_year) y = startYear(t.school_year, id);
    else {
      const m = /likely (\d{4}-\d{2})/.exec(t.notes);
      if (!m) { errors.push(`${id}: undated rate and no "likely YYYY-YY" in the note`); continue; }
      y = startYear(m[1], id);
      stated = "no";
    }
    real.push({
      school_id: id, year: y, tuition: std!, parish_rate: parish ?? "", year_stated: stated, confidence: t.confidence,
      notes: t.notes, provenance: "REAL", source_url: t.source_url,
    });
    const prior = /Up from \$([\d,]+)(?: in (\d{4}-\d{2}))?/.exec(t.notes);
    if (prior) {
      const py = prior[2] ? startYear(prior[2], `${id} prior`) : y - 1;
      real.push({
        school_id: id, year: py, tuition: Number(prior[1].replace(/,/g, "")), parish_rate: "", year_stated: prior[2] ? "yes" : "no",
        confidence: t.confidence, notes: `Prior-year rate quoted on the ${y}-${String((y + 1) % 100).padStart(2, "0")} page.`,
        provenance: "REAL", source_url: t.source_url,
      });
    }
    outcome = stated === "yes" ? "published by school" : "published by school, year not stated";
  } else if (t.confidence === "third_party") {
    if (std === null) errors.push(`${id}: third-party entry with no rate`);
    unverified.push({ school_id: id, school_year: t.school_year ?? "", tuition: std!, parish_rate: parish ?? "", notes: t.notes, source_url: t.source_url });
    outcome = "third-party listing only (unverified)";
  } else if (t.confidence === "not_found") {
    outcome = "not published or unreadable";
  } else errors.push(`${id}: unknown confidence "${t.confidence}"`);

  review.push({ school_id: id, confidence: t.confidence, outcome, notes: t.notes, source_url: t.source_url });
}
for (const s of [...schools.values()].filter((s) => s.governance === "parish_elementary")) {
  if (!raw.schools[s.id]) errors.push(`${s.id}: parish school missing from the tuition file`);
}
if (errors.length) {
  console.error(`Import stopped: ${errors.length} problem(s) in ${file}\n  ` + errors.join("\n  "));
  process.exit(1);
}
writeFileSync(join(root, "data", "tuition.csv"), toCsv(real as never[], ["school_id", "year", "tuition", "parish_rate", "year_stated", "confidence", "notes", "provenance", "source_url"] as never[]));
writeFileSync(join(root, "data", "tuition_unverified.csv"), toCsv(unverified as never[], ["school_id", "school_year", "tuition", "parish_rate", "notes", "source_url"] as never[]));
writeFileSync(join(root, "data", "tuition_review.csv"), toCsv(review as never[], ["school_id", "confidence", "outcome", "notes", "source_url"] as never[]));
const c = (k: string) => review.filter((r) => r.confidence === k).length;
console.log(`${file}: ${real.length} REAL rows (${c("school")} dated, ${c("school_undated")} undated), ${unverified.length} unverified, ${c("not_found")} not found.`);
