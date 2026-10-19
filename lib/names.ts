/**
 * The one place a school's name is chosen for display.
 *
 * Rule: a real school's name appears only where everything shown beside it is REAL.
 * Simulated values belong to the fictional demo schools, whose names are already
 * pseudonyms ("School A" ... "School Y"). Asking for a real name in a simulated
 * context is a bug, so it throws instead of quietly printing the name.
 */
import type { MixedProvenance } from "./data";
import type { School } from "./types";

export function displayName(school: School, context: MixedProvenance | "PROJECTED"): string {
  if (school.demo) return school.name;
  if (context === "REAL" || context === "PROJECTED") return school.name;
  throw new Error(`displayName: real school "${school.id}" asked for in a ${context} context`);
}

/** Link target for a school: real schools and demo schools have separate pages. */
export const schoolHref = (school: School) => (school.demo ? `/demo/schools/${school.id}` : `/schools/${school.id}`);
