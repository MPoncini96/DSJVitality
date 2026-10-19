/**
 * The operating calendar, as a yearly cycle that starts in July. Dates are worked out
 * for whichever cycle "today" falls in, so the calendar never goes stale. Only entries
 * with a `source` are published dates; the rest are typical timings for a Catholic
 * school system, to be confirmed with the Department of Catholic Schools.
 */
import { CDE_NEXT_RELEASE } from "./config";

export interface CalendarItem {
  /** first and last day, YYYY-MM-DD */
  start: string;
  end: string;
  title: string;
  area: "Enrollment" | "Finance" | "Facilities" | "Systems" | "Reporting";
  note: string;
  typical: boolean;
  source?: string;
}

const sy = (y: number) => `${y}-${String((y + 1) % 100).padStart(2, "0")}`;
const d = (y: number, md: string) => `${y}-${md}`;

/** Items for the cycle that starts July 1 of year `y` (school year y-(y+1)). */
export function cycle(y: number): CalendarItem[] {
  return [
    { start: d(y, "10-01"), end: d(y, "10-15"), title: "Private School Affidavit filing window", area: "Reporting", note: `Every school files ${sy(y)} enrollment with the California Department of Education.`, typical: false, source: "https://www.cde.ca.gov/SP/PS/affidavit.asp" },
    { start: d(y, "10-01"), end: d(y, "11-30"), title: "Open-house and tour season", area: "Enrollment", note: "Inquiry follow-up speed matters most here.", typical: true },
    { start: d(y, "10-20"), end: d(y, "10-20"), title: "September financial close; monthly report", area: "Finance", note: "Budget vs. actual, cash, receivables, risks.", typical: true },
    { start: d(y, "11-01"), end: d(y + 1, "01-15"), title: `Set and announce ${sy(y + 1)} tuition`, area: "Finance", note: "Check proposals against tuition guidelines before announcement.", typical: true },
    { start: d(y, "11-17"), end: d(y, "11-17"), title: "October financial close; monthly report", area: "Finance", note: "", typical: true },
    { start: d(y, "12-01"), end: d(y + 1, "03-01"), title: "Tuition-assistance application window (TADS)", area: "Finance", note: "Same deadlines and rules at every school.", typical: true },
    { start: d(y + 1, "01-15"), end: d(y + 1, "03-15"), title: `Re-enrollment for ${sy(y + 1)}`, area: "Enrollment", note: "Earliest reliable signal for next fall.", typical: true },
    { start: d(y + 1, "03-01"), end: d(y + 1, "05-15"), title: `School budgets for FY${y + 2}`, area: "Finance", note: "Drafts reviewed against enrollment scenarios and re-enrollment.", typical: true },
    { start: d(y + 1, "06-15"), end: d(y + 1, "08-15"), title: "Summer facilities work window", area: "Facilities", note: "Life-safety items first.", typical: true },
  ];
}

/** The next CDE release of affidavit data (its timing is not announced in advance). */
export function nextCdeRelease(latestYear: number) {
  return { title: `CDE publishes ${sy(latestYear + 1)} affidavit data`, when: CDE_NEXT_RELEASE, source: "https://www.cde.ca.gov/ds/si/ps/" };
}

const iso = (t: Date) => t.toISOString().slice(0, 10);

/** Split the calendar around `today`: what is coming up (next `days`) and what recently passed. */
export function around(today: Date, days = 90, pastDays = 45) {
  const t = iso(today);
  const y = today.getUTCMonth() >= 6 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
  const items = [...cycle(y - 1), ...cycle(y), ...cycle(y + 1)];
  const lim = new Date(today); lim.setUTCDate(lim.getUTCDate() + days);
  const past = new Date(today); past.setUTCDate(past.getUTCDate() - pastDays);
  return {
    upcoming: items.filter((c) => c.end >= t && c.start <= iso(lim)).sort((a, b) => a.start.localeCompare(b.start)),
    passed: items.filter((c) => c.end < t && c.end >= iso(past)).sort((a, b) => b.end.localeCompare(a.end)),
  };
}
