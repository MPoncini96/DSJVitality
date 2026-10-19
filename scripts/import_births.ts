/**
 * Import REAL births near each school (CDPH final births by ZIP of mother's residence).
 *
 *   input:  data/raw/cdph_births_catchment_<date>.json
 *   output: data/births.csv          school_id, birth_year, births, catchment_zips (REAL)
 *           data/county_births.csv   birth_year, births (REAL; county ZIPs total)
 *
 * Catchment = ZIPs whose centroid is within 4 miles of the school's ZIP centroid.
 * Catchments overlap, so school counts must never be summed; use county totals instead.
 *
 * Run: npm run data:births
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, toCsv } from "../lib/csv";

const root = join(__dirname, "..");
const rawDir = join(root, "data", "raw");
const file = readdirSync(rawDir).filter((f) => /^cdph_births_catchment_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
if (!file) throw new Error("No data/raw/cdph_births_catchment_<date>.json found.");

interface Raw {
  source: { name: string; url: string; retrieved: string; method: string };
  county_zips_total: Record<string, number>;
  schools: Record<string, { home_zip: string; births_by_year: Record<string, number>; metrics: { catchment_zips: string[] } }>;
}
const raw: Raw = JSON.parse(readFileSync(join(rawDir, file), "utf8"));
const SOURCE = `${raw.source.url} (retrieved ${raw.source.retrieved})`;
const schools = new Map(parseCsv(readFileSync(join(root, "data", "schools.csv"), "utf8")).map((s) => [s.id, s]));

const errors: string[] = [];
const year = (y: string, where: string) => {
  const n = Number(y);
  if (!/^\d{4}$/.test(y) || n < 2000 || n > 2030) errors.push(`${where}: "${y}" is not a birth year`);
  return n;
};
const count = (v: unknown, where: string) => {
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > 100000) errors.push(`${where}: births ${JSON.stringify(v)} is not a count`);
  return Number(v);
};

const rows: Record<string, string | number>[] = [];
for (const [id, s] of Object.entries(raw.schools)) {
  const dir = schools.get(id);
  if (!dir) { errors.push(`${id}: not in data/schools.csv`); continue; }
  if (s.home_zip !== dir.zip) errors.push(`${id}: home ZIP ${s.home_zip} differs from directory ZIP ${dir.zip}`);
  const zips = s.metrics.catchment_zips;
  if (!zips.includes(s.home_zip)) errors.push(`${id}: catchment does not include its home ZIP`);
  for (const [y, b] of Object.entries(s.births_by_year)) {
    rows.push({ school_id: id, birth_year: year(y, id), births: count(b, `${id} ${y}`), catchment_zips: zips.join(" "), provenance: "REAL", source: SOURCE });
  }
}
const county = Object.entries(raw.county_zips_total).map(([y, b]) => ({
  birth_year: year(y, "county"), births: count(b, `county ${y}`), provenance: "REAL", source: SOURCE,
}));
for (const s of [...schools.values()].filter((s) => s.governance === "parish_elementary")) {
  if (!raw.schools[s.id]) errors.push(`${s.id}: parish school has no births record`);
}

if (errors.length) {
  console.error(`Import stopped: ${errors.length} problem(s) in ${file}\n  ` + errors.join("\n  "));
  process.exit(1);
}
writeFileSync(join(root, "data", "births.csv"), toCsv(rows as never[], ["school_id", "birth_year", "births", "catchment_zips", "provenance", "source"] as never[]));
writeFileSync(join(root, "data", "county_births.csv"), toCsv(county, ["birth_year", "births", "provenance", "source"]));
console.log(`${file}: ${Object.keys(raw.schools).length} schools, ${rows.length} school-year rows, county ${county[0].birth_year}..${county.at(-1)!.birth_year}.`);
