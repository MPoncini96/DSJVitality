/**
 * The few constants every page shares. Dates shown on the site come from the data
 * files (the latest school year present) or from this file, never from page code.
 */

/** Base year for the long enrollment trend: 2019-20, the last year before COVID. */
export const BASE_YEAR = 2019;

/** When the latest CDE affidavit year was published (the year itself is read from the data). */
export const CDE_PUBLISHED = "Sept 2026";

/** The next CDE release, for the calendar. */
export const CDE_NEXT_RELEASE = "typically late summer to fall";

/**
 * The simulated internal data (finance, facilities, admissions, turnaround) is a
 * snapshot taken on this date. It belongs only to the fictional demo schools.
 */
export const DEMO_AS_OF = "2026-10-01";

/** Scenario ranges cap the trend so one bad year can't run off to zero. */
export const SCENARIO_CAGR_CAP: [number, number] = [-0.06, 0.04];
