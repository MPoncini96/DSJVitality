/**
 * Build data/schools.csv from versioned raw snapshots in data/raw/.
 *
 *   data/raw/dsj_find_a_school_<date>.csv  transcription of https://www.dsj.org/find-a-school/
 *   data/raw/geocode_census_<date>.csv     US Census Geocoder (Public_AR_Current) results
 *   data/raw/governance_<date>.csv         governance overrides (everything else = parish_elementary)
 *
 * Any value that does not come straight from the directory is logged to
 * data/corrections.csv so it can be reviewed.
 *
 * Run: npm run data:schools
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, toCsv } from "../lib/csv";

const SNAPSHOT_DATE = "2026-10-16";
const SOURCE_URL = "https://www.dsj.org/find-a-school/";
const GEOCODER = "US Census Geocoder, benchmark Public_AR_Current";

const root = join(__dirname, "..");
const raw = (f: string) => parseCsv(readFileSync(join(root, "data", "raw", f), "utf8"));

const directory = raw(`dsj_find_a_school_${SNAPSHOT_DATE}.csv`);
const geocodes = new Map(raw(`geocode_census_${SNAPSHOT_DATE}.csv`).map((r) => [r.id, r]));
const governance = new Map(raw(`governance_${SNAPSHOT_DATE}.csv`).map((r) => [r.id, r]));

interface Correction {
  school_id: string;
  field: string;
  source_value: string;
  new_value: string;
  method: string;
  needs_review: string;
}
const corrections: Correction[] = [];

const rows = directory.map((d) => {
  const g = geocodes.get(d.id);
  if (!g) throw new Error(`No geocode row for ${d.id}`);

  // ZIP: use the directory's value; fill from the geocoder only when blank.
  const geoZip = g.matched_address.match(/(\d{5})\s*$/)?.[1] ?? "";
  let zip = d.zip;
  let zipSource = "source";
  if (!zip) {
    zip = geoZip;
    zipSource = "geocoder";
    corrections.push({
      school_id: d.id, field: "zip", source_value: "", new_value: geoZip,
      method: `filled from ${GEOCODER}`, needs_review: "no",
    });
  } else if (geoZip && geoZip !== zip) {
    corrections.push({
      school_id: d.id, field: "zip", source_value: zip, new_value: zip,
      method: `geocoder returned ${geoZip}; kept directory value`, needs_review: "yes",
    });
  }

  if (g.note && g.note !== "ok") {
    corrections.push({
      school_id: d.id, field: "lat/lng", source_value: d.address, new_value: `${g.lat},${g.lng}`,
      method: g.note, needs_review: "yes",
    });
  }

  const gov = governance.get(d.id);
  return {
    id: d.id,
    name: d.name,
    address: d.address,
    city: d.city,
    zip,
    zip_source: zipSource,
    phone: d.phone,
    website: d.website,
    grades: "",
    parish: "",
    governance: gov?.governance ?? "parish_elementary",
    governance_basis: gov?.basis ?? "inferred - verify",
    lat: Number(g.lat).toFixed(6),
    lng: Number(g.lng).toFixed(6),
    geocode_match: g.matched_address,
    geocode_note: g.note,
    source_url: SOURCE_URL,
    retrieved: SNAPSHOT_DATE,
  };
});

const parish = rows.filter((r) => r.governance === "parish_elementary").length;
if (rows.length !== 33) throw new Error(`Expected 33 schools, got ${rows.length}`);
if (parish !== 25) throw new Error(`Expected 25 parish elementary schools, got ${parish}`);

writeFileSync(
  join(root, "data", "schools.csv"),
  toCsv(rows, [
    "id", "name", "address", "city", "zip", "zip_source", "phone", "website", "grades", "parish",
    "governance", "governance_basis", "lat", "lng", "geocode_match", "geocode_note", "source_url", "retrieved",
  ])
);
writeFileSync(
  join(root, "data", "corrections.csv"),
  toCsv(corrections, ["school_id", "field", "source_value", "new_value", "method", "needs_review"])
);
console.log(`schools.csv: ${rows.length} schools (${parish} parish elementary). corrections.csv: ${corrections.length} rows.`);
