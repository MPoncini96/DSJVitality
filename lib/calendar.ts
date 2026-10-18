/**
 * The operating calendar. Only entries with a `source` are REAL; the rest are
 * typical timings for a Catholic school system, to be confirmed with the
 * Department of Catholic Schools.
 */
import type { Provenance } from "./types";

export interface CalendarItem {
  /** first day, YYYY-MM-DD */
  start: string;
  /** last day, YYYY-MM-DD */
  end: string;
  title: string;
  area: "Enrollment" | "Finance" | "Facilities" | "Systems" | "Reporting";
  note: string;
  provenance: Provenance;
  source?: string;
}

export const CALENDAR: CalendarItem[] = [
  { start: "2026-10-01", end: "2026-10-15", title: "Private School Affidavit filing window", area: "Reporting", note: "Every school files enrollment with the California Department of Education. The affidavit is a snapshot as of filing.", provenance: "REAL", source: "https://www.cde.ca.gov/SP/PS/affidavit.asp" },
  { start: "2026-10-01", end: "2026-11-30", title: "Open-house and tour season", area: "Enrollment", note: "Inquiry follow-up speed matters most here.", provenance: "SAMPLE" },
  { start: "2026-10-20", end: "2026-10-20", title: "September financial close; monthly report to the Department", area: "Finance", note: "Budget vs. actual, cash, receivables, risks.", provenance: "SAMPLE" },
  { start: "2026-11-01", end: "2027-01-15", title: "Set and announce 2027-28 tuition", area: "Finance", note: "Check proposals against tuition guidelines before announcement.", provenance: "SAMPLE" },
  { start: "2026-11-17", end: "2026-11-17", title: "October financial close; monthly report", area: "Finance", note: "", provenance: "SAMPLE" },
  { start: "2026-12-01", end: "2027-03-01", title: "Tuition-assistance application window (TADS)", area: "Finance", note: "Communicate deadlines to every school; same rules everywhere.", provenance: "SAMPLE" },
  { start: "2027-01-15", end: "2027-03-15", title: "Re-enrollment for 2027-28", area: "Enrollment", note: "Earliest reliable signal for next fall.", provenance: "SAMPLE" },
  { start: "2027-03-01", end: "2027-05-15", title: "School budgets for FY2028", area: "Finance", note: "Drafts reviewed against enrollment forecast and re-enrollment.", provenance: "SAMPLE" },
  { start: "2027-06-15", end: "2027-08-15", title: "Summer facilities work window", area: "Facilities", note: "Life-safety items first.", provenance: "SAMPLE" },
];

export function upcoming(asOf: string, days = 75): CalendarItem[] {
  const limit = new Date(`${asOf}T00:00:00Z`);
  limit.setUTCDate(limit.getUTCDate() + days);
  const lim = limit.toISOString().slice(0, 10);
  return CALENDAR.filter((c) => c.end >= asOf && c.start <= lim).sort((a, b) => a.start.localeCompare(b.start));
}
