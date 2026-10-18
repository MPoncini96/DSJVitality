/**
 * Import REAL enrollment and staffing from the CDE Private School Affidavit.
 *
 *   input:  data/raw/cde_enrollment_<date>.json   (written by scripts/fetch_cde_enrollment.py)
 *   output: data/enrollment.csv     school_id, year, grade, count (REAL)
 *           data/staffing.csv       school_id, year, teachers/admins/other staff (REAL)
 *           data/match_review.csv   one row per school: CDE name vs directory name, data issues
 *
 * Every value is validated before anything is written; a bad row stops the import
 * with a message naming the school, year and field.
 *
 * Run: npm run data:cde   (uses the newest raw file)
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseCsv, toCsv } from "../lib/csv";

const root = join(__dirname, "..");
const rawDir = join(root, "data", "raw");
const file = readdirSync(rawDir).filter((f) => /^cde_enrollment_\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort().at(-1);
if (!file) throw new Error("No data/raw/cde_enrollment_<date>.json found. Run scripts/fetch_cde_enrollment.py first.");

interface HistoryRow { year: string; total: number | null; [k: string]: number | string | null }
interface Raw {
  source: { name: string; url: string; retrieved: string; notes?: string };
  schools: Record<string, { cds_code: string; name: string; former_names: string[]; public_district: string; history: HistoryRow[] }>;
}
const raw: Raw = JSON.parse(readFileSync(join(rawDir, file), "utf8"));
const SOURCE = `${raw.source.url} (retrieved ${raw.source.retrieved})`;

const schools = new Map(parseCsv(readFileSync(join(root, "data", "schools.csv"), "utf8")).map((s) => [s.id, s]));
const GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"];

const errors: string[] = [];
const int = (v: unknown, where: string, field: string, opts: { min?: number; max?: number } = {}) => {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n)) { errors.push(`${where}: ${field} is not a whole number (${JSON.stringify(v)})`); return 0; }
  if (opts.min !== undefined && n < opts.min) errors.push(`${where}: ${field} = ${n} is below ${opts.min}`);
  if (opts.max !== undefined && n > opts.max) errors.push(`${where}: ${field} = ${n} is above ${opts.max}`);
  return n;
};
const startYear = (label: string, where: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(label);
  if (!m || (Number(m[1]) + 1) % 100 !== Number(m[2])) { errors.push(`${where}: year "${label}" is not like 2025-26`); return 0; }
  return Number(m[1]);
};

const enrollment: { school_id: string; year: number; grade: string; count: number; provenance: string; source: string }[] = [];
const staffing: Record<string, string | number>[] = [];
const review: Record<string, string>[] = [];

for (const [slug, s] of Object.entries(raw.schools)) {
  const dir = schools.get(slug);
  if (!dir) { errors.push(`${slug}: not in data/schools.csv`); continue; }
  if (!/^\d{14}$/.test(s.cds_code)) errors.push(`${slug}: CDS code "${s.cds_code}" is not 14 digits`);
  const issues: string[] = [];
  const years: number[] = [];

  for (const h of s.history) {
    const where = `${slug} ${h.year}`;
    const y = startYear(h.year, where);
    years.push(y);
    let sum = 0;
    for (const g of GRADES) {
      const c = int(h[g], where, `grade ${g}`, { min: 0, max: 400 });
      sum += c;
      enrollment.push({ school_id: slug, year: y, grade: g, count: c, provenance: "REAL", source: SOURCE });
    }
    const total = int(h.total, where, "total", { min: 0, max: 3000 });
    if (total !== sum) issues.push(`${h.year}: reported total ${total} vs grade sum ${sum} (difference ${total - sum}, likely TK/ungraded)`);
    staffing.push({
      school_id: slug, year: y,
      ft_teachers: int(h.ft_teachers, where, "ft_teachers", { min: 0, max: 200 }),
      pt_teachers: int(h.pt_teachers, where, "pt_teachers", { min: 0, max: 200 }),
      admins: int(h.admins, where, "admins", { min: 0, max: 50 }),
      other_staff: int(h.other_staff, where, "other_staff", { min: 0, max: 300 }),
      provenance: "REAL", source: SOURCE,
    });
  }

  years.sort();
  for (let y = years[0]; y <= years.at(-1)!; y++) if (!years.includes(y)) issues.push(`${y}-${String((y + 1) % 100).padStart(2, "0")}: missing from the CDE file`);
  for (let i = 1; i < s.history.length; i++) {
    const a = s.history[i - 1].total ?? 0, b = s.history[i].total ?? 0;
    if (a > 0 && Math.abs(b / a - 1) > 0.3) issues.push(`${s.history[i - 1].year}→${s.history[i].year}: total changed ${Math.round((b / a - 1) * 100)}%, confirm with the school`);
  }
  const norm = (x: string) => x.toLowerCase().replace(/\bst\.?\s|\bsaint\s/g, "st ").replace(/[^a-z ]/g, "").replace(/\b(school|elementary|catholic|parish|and|middle|the)\b/g, "").replace(/\s+/g, " ").trim();
  const nameMatch = norm(s.name) === norm(dir.name) ? "same" : "differs";
  review.push({
    school_id: slug,
    directory_name: dir.name,
    cde_name: s.name,
    former_cde_names: s.former_names.join("; "),
    cds_code: s.cds_code,
    public_district: s.public_district,
    years: `${s.history[0].year}..${s.history.at(-1)!.year}`,
    match_basis: "CDS code (fixed list in scripts/fetch_cde_enrollment.py)",
    name_check: nameMatch,
    issues: issues.join(" | "),
    needs_review: nameMatch === "differs" || issues.length ? "yes" : "no",
  });
}

const parish = [...schools.values()].filter((s) => s.governance === "parish_elementary").map((s) => s.id);
for (const id of parish) if (!raw.schools[id]) errors.push(`${id}: parish school has no CDE record`);

if (errors.length) {
  console.error(`Import stopped: ${errors.length} problem(s) in ${file}\n  ` + errors.join("\n  "));
  process.exit(1);
}

writeFileSync(join(root, "data", "enrollment.csv"), toCsv(enrollment, ["school_id", "year", "grade", "count", "provenance", "source"]));
writeFileSync(join(root, "data", "staffing.csv"), toCsv(staffing as never[], ["school_id", "year", "ft_teachers", "pt_teachers", "admins", "other_staff", "provenance", "source"] as never[]));
writeFileSync(join(root, "data", "match_review.csv"), toCsv(review as never[], ["school_id", "directory_name", "cde_name", "former_cde_names", "cds_code", "public_district", "years", "match_basis", "name_check", "issues", "needs_review"] as never[]));
console.log(`${file}: ${Object.keys(raw.schools).length} schools, ${enrollment.length} grade rows, ${review.filter((r) => r.needs_review === "yes").length} flagged for review.`);
