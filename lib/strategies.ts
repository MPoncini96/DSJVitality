/**
 * Enrollment strategies: the "find what works and spread it" approach.
 *
 * 1. Bright spots: real schools whose public data shows something going right.
 *    They are named, because the data is real and the finding is positive; the
 *    page says what the data shows, not why. The "why" comes from asking them.
 * 2. Patterns: what the public data suggests about where a school is losing
 *    students. Descriptive only, each one pointing to a group of strategies.
 * 3. Strategies: practices from published sources, grouped by the lever they pull.
 *
 * Thresholds are starting points, like the alert thresholds.
 */
import type { SchoolMetrics } from "./metrics";

export interface Source { id: string; title: string; publisher: string; url: string; note: string }

export const SOURCES: Source[] = [
  { id: "pd", title: "Positive Deviance for Educators", publisher: "Stanford d.school K12 Lab", url: "https://dschool.stanford.edu/stories/positive-deviance-for-educators", note: "Find people in your own system who already solve the problem, learn what explains it, and spread it; favors practices that need no extra resources." },
  { id: "switch", title: "Switch: Don't Solve Problems, Copy Success", publisher: "Chip and Dan Heath", url: "https://www.goodreads.com/author_blog_posts/317501-switch-don-t-solve-problems--copy-success", note: "\"Find a bright spot and clone it.\"" },
  { id: "ncea", title: "Understanding the Catholic School Enrollment Boost (issue brief)", publisher: "NCEA with the Manhattan Institute", url: "https://ncea.org/NCEA/How_We_Serve/News/Press_Releases/New_Issue_Brief__Understanding_the_Catholic_School_Enrollment_Boost.aspx", note: "2021-22: enrollment up 3.8%, the first national rise in 25 years; pre-K was about two-thirds of the gain. Recommends simpler admission and aid paperwork, and keeping pre-K families through kindergarten." },
  { id: "playbook", title: "Enrollment Management Reference Guide and Playbook, 2022-23", publisher: "Catholic Schools in Brooklyn and Queens (Marketing and Development Resource Center)", url: "https://www.catholicschoolsbq.org/wp-content/uploads/2022/11/Enrollment-Playbook_2022-23_Digital.pdf", note: "Inquiry response within 24 hours, one owner for inquiries, early re-enrollment with a target of 85% by Catholic Schools Week, personal calls to every family, baptism lists and parish bulletins." },
  { id: "ace-tf", title: "To Nurture the Soul of a Nation: Latino Families, Catholic Schools, and Educational Opportunity", publisher: "University of Notre Dame Task Force, 2009", url: "https://ace.nd.edu/sites/default/files/2022-03/Task%20Force%20Report-Executive%20Summary.pdf", note: "Income explains only about a third of the gap in Latino enrollment; information, culture and leadership explain the rest. Recommends personal recruiting, promotion from the pulpit, Spanish-speaking outreach, creative tuition assistance and early childhood programs." },
  { id: "ace-lei", title: "Latino Enrollment Institute", publisher: "Alliance for Catholic Education, Notre Dame (2018)", url: "https://ace.nd.edu/news/7th-annual-latino-enrollment-institute-serves-190-school-leaders", note: "Mentor principals and madrinas (bilingual parent liaisons). Reported examples: Latino enrollment 100 to 142 at one school, 77 to 167 at another." },
  { id: "tk", title: "Universal prekindergarten is coming to California", publisher: "PACE (from The Washington Post), March 2024", url: "https://edpolicyinca.org/news/universal-prekindergarten-coming-california-bumpy-rollout-and-all", note: "Free public transitional kindergarten for every 4-year-old, fully in place by 2025-26." },
];

export interface BrightSpot {
  key: string;
  title: string;
  shows: string;
  test: (m: SchoolMetrics) => boolean;
  /** what to ask the school */
  ask: string;
}

export const BRIGHT_SPOTS: BrightSpot[] = [
  {
    key: "holding",
    title: "Holding or growing while local births fell",
    shows: "Enrollment at or above its 2019-20 level, although births near the school are down over five years.",
    test: (m) => (m.enrollment.changeSinceBase ?? -1) >= 0 && (m.market.births5Change ?? 0) < 0,
    ask: "What changed since 2019-20 in how you find, welcome and keep families?",
  },
  {
    key: "kshare",
    title: "Winning a growing share of local kindergartners",
    shows: "Kindergarten as a share of births five years earlier is rising by 3% a year or more.",
    test: (m) => (m.market.shareTrend ?? 0) >= 0.03,
    ask: "Where do your new kindergarten families first hear about you, and what makes them choose you?",
  },
  {
    key: "joiners",
    title: "Adding students after kindergarten",
    shows: "Each grade is at least 5% larger than the same class the year before (3-year average), so more students join than leave.",
    test: (m) => (m.enrollment.cohortRetention ?? 0) >= 1.05,
    ask: "Who are the students joining in grades 1–8, and why did their families switch?",
  },
];

export interface Pattern {
  key: string;
  title: string;
  shows: string;
  test: (m: SchoolMetrics) => boolean;
  /** strategy groups to look at first */
  levers: string[];
}

export const PATTERNS: Pattern[] = [
  {
    key: "births",
    title: "Fewer children nearby",
    shows: "Births near the school down 10% or more over five years. Most schools share this; it shrinks the pool, not the school's appeal.",
    test: (m) => (m.market.births5Change ?? 0) <= -0.1,
    levers: ["early", "reach"],
  },
  {
    key: "share",
    title: "Losing share of local families",
    shows: "Kindergarten as a share of local births falling by 3% a year or more: families nearby are choosing elsewhere.",
    test: (m) => (m.market.shareTrend ?? 0) <= -0.03,
    levers: ["admissions", "parish", "early"],
  },
  {
    key: "between",
    title: "Losing students between grades",
    shows: "Fewer than 92% of students continue to the next grade (3-year average).",
    test: (m) => (m.enrollment.cohortRetention ?? 1) < 0.92,
    levers: ["retention", "afford"],
  },
];

export interface Strategy { what: string; why: string; metric: string; sources: string[] }
export interface Lever { key: string; title: string; summary: string; strategies: Strategy[] }

export const LEVERS: Lever[] = [
  {
    key: "admissions",
    title: "Admissions basics",
    summary: "Most lost families are lost between the first inquiry and the tour. This is the cheapest lever and the quickest to check.",
    strategies: [
      { what: "One person owns every inquiry; every inquiry gets a reply within 24 hours (48 at most), then a phone call and a tour invitation.", why: "Families compare schools at the same time; the first warm reply often wins.", metric: "Median hours to first reply; inquiry-to-tour rate", sources: ["playbook"] },
      { what: "A first-impressions audit: someone new to the school walks the tour route and the website for 30 minutes, and the school fixes what they find.", why: "Schools stop seeing their own entrance, signs and broken links.", metric: "Tour-to-application rate", sources: ["playbook"] },
      { what: "Information nights of 45–60 minutes with the principal, pastor and early-grade teachers, and a follow-up email the next day.", why: "Puts the people families will trust in front of them.", metric: "Attendees who book a tour within two weeks", sources: ["playbook"] },
      { what: "Simplify admission and aid paperwork: one clear page on cost, assistance and deadlines.", why: "Confusing forms and unclear tuition policies are a barrier on their own.", metric: "Applications started vs. completed", sources: ["ncea"] },
    ],
  },
  {
    key: "early",
    title: "Early childhood pipeline",
    summary: "Pre-K drove most of the last national enrollment gain. In California, free public TK for every 4-year-old (fully in place in 2025-26) makes the pre-K-to-K handoff the moment to win or lose a family.",
    strategies: [
      { what: "Treat pre-K and TK families as future kindergartners: personal invitations from the K teacher, a \"spend a day in K\" visit and an early letter of intent.", why: "Many families pay for pre-K but leave for free kindergarten elsewhere.", metric: "Share of pre-K families who enroll in K", sources: ["ncea", "playbook"] },
      { what: "Reach parish families with children turning 3 to 5 through baptism records, with the pastor's support.", why: "These families already have a tie to the parish.", metric: "K applications from parish families", sources: ["playbook"] },
      { what: "Early sibling registration for current families.", why: "The easiest kindergarten family to enroll is one already at the school.", metric: "Siblings enrolled / eligible siblings", sources: ["playbook"] },
    ],
  },
  {
    key: "retention",
    title: "Keeping the families you have",
    summary: "A returning family costs nothing to recruit. Re-enrollment is the earliest reliable signal for next fall.",
    strategies: [
      { what: "Open re-enrollment early (around November) and aim for 85% of families by Catholic Schools Week.", why: "An early deadline surfaces at-risk families while there is time to talk.", metric: "Re-enrollment rate by Catholic Schools Week", sources: ["playbook"] },
      { what: "Call every family personally, keep a plan for each family at risk, and hold a real conversation with every family that leaves.", why: "Exit reasons are the best list of what to fix.", metric: "Families not yet re-enrolled, tracked weekly to zero", sources: ["playbook"] },
      { what: "\"Step up\" days where students spend a class period with next year's teacher, especially before grades 6 and 7.", why: "The move to middle school is when families shop around.", metric: "Grade 5→6 and 6→7 continuation", sources: ["playbook"] },
    ],
  },
  {
    key: "parish",
    title: "Parish partnership",
    summary: "The parish is the school's largest network of families.",
    strategies: [
      { what: "Regular coffee with the pastor, a year-long bulletin plan, and a vestibule table with flyers in the languages of the parish.", why: "Keeps the school in front of every parish family, every week.", metric: "Inquiries that name the parish as the source", sources: ["playbook"] },
      { what: "Promote Catholic schools from the pulpit.", why: "A personal word from the pastor carries weight no flyer does.", metric: "Inquiries in the weeks after", sources: ["ace-tf"] },
    ],
  },
  {
    key: "reach",
    title: "Families who haven't been asked",
    summary: "When the pool of children shrinks, growth comes from families the school hasn't reached: often Latino and other immigrant Catholic families.",
    strategies: [
      { what: "Personal, Spanish-speaking (and other community-language) outreach, with parent liaisons (\"madrinas\") who welcome new families.", why: "Income explains only about a third of the gap; information, culture and welcome explain the rest.", metric: "New families from outreach; their re-enrollment", sources: ["ace-tf", "ace-lei"] },
      { what: "Pair a principal with a mentor principal who has already done it.", why: "The Latino Enrollment Institute's model; the same idea as learning from bright spots.", metric: "Action-plan steps completed", sources: ["ace-lei"] },
    ],
  },
  {
    key: "afford",
    title: "Affordability and clarity",
    summary: "Cost matters, but so does how clearly it is explained.",
    strategies: [
      { what: "Publish tuition, the parishioner rate and how assistance works on one page; use tuition assistance creatively for families who would otherwise leave.", why: "Unclear cost stops families before they ask about aid.", metric: "Aid applicants who enroll; families leaving for cost", sources: ["ncea", "ace-tf"] },
    ],
  },
];

export const leverByKey = (k: string) => LEVERS.find((l) => l.key === k)!;
