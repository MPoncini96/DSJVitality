import Link from "next/link";
import { SimTag } from "@/components/ProvenanceBadge";
import { stateDataLabel } from "@/components/school";
import { Card, PageHeader } from "@/components/ui";
import { BASE_YEAR, CDE_PUBLISHED, DEMO_AS_OF, SCENARIO_CAGR_CAP } from "@/lib/config";
import { getCountyBirths, latestEnrollmentYear } from "@/lib/data";
import { dateLong, schoolYear } from "@/lib/format";
import { COMPOSITE_WEIGHTS, TIER_CUTS, VITALITY } from "@/lib/health";
import { THRESHOLDS } from "@/lib/radar";

export const metadata = { title: "About the data · School Vitality Prototype" };

function sources(births: number[], latest: number) {
  return [
  { what: "School list, addresses, websites", who: "Diocese of San José public school directory", url: "https://www.dsj.org/find-a-school/" },
  { what: `Enrollment by grade (K–8) and staffing, ${schoolYear(BASE_YEAR)} to ${schoolYear(latest)}`, who: "California Department of Education, Private School Affidavit", url: "https://www.cde.ca.gov/ds/si/ps/" },
  { what: `Births by ZIP code of the mother's residence, ${Math.min(...births)}–${Math.max(...births)}`, who: "California Department of Public Health, via CHHS Open Data", url: "https://data.chhs.ca.gov/dataset/live-birth-profiles-by-zip-code" },
  { what: "Published tuition", who: "Each school's own website (link on each school page)", url: "" },
  { what: "Latitude and longitude", who: "US Census Geocoder", url: "https://geocoding.geo.census.gov/geocoder/" },
  ];
}

export default function About() {
  const SOURCES = sources(getCountyBirths().map((b) => b.birthYear), latestEnrollmentYear());
  return (
    <div className="space-y-8">
      <PageHeader title="About the data" sub={<>An independent prototype. What is real, what is simulated, and how the numbers are worked out. {stateDataLabel(CDE_PUBLISHED)}.</>} />

      <Card title="How to read the site" id="legend-h">
        <dl className="grid gap-4 text-sm sm:grid-cols-3">
          <div className="rounded-lg border border-border p-3">
            <dt className="font-semibold">Real public data</dt>
            <dd className="mt-1 text-muted">Cards render normally, with their source cited. Every real school&apos;s name appears only next to real data.</dd>
          </div>
          <div className="sample-edge rounded-lg border border-border p-3">
            <dt className="flex items-center gap-2 font-semibold">Simulated <SimTag /></dt>
            <dd className="mt-1 text-muted">Hatched cards. Internal data (budgets, cash, assistance, facilities, admissions, data feeds, the Turnaround Program) for 25 fictional demo schools, School A–Y, as of {dateLong(DEMO_AS_OF)}.</dd>
          </div>
          <div className="rounded-lg border border-border p-3">
            <dt className="font-semibold">Notes in italics</dt>
            <dd className="mt-1 text-muted"><em>Scenario, not a forecast</em>: a range worked out from real data. <em>Unverified</em>: a tuition figure from a third-party site, shown for reference and never used in a calculation.</dd>
          </div>
        </dl>
      </Card>

      <Card title="Why the simulated data has its own fictional schools" id="why-h">
        <p className="text-sm">
          A dashboard like this needs internal data that isn&apos;t public. Rather than attach invented deficits or turnaround status to a
          real school, the simulated data belongs to 25 schools that don&apos;t exist. They are generated from generic ranges with a fixed
          seed, not from any real school&apos;s figures, so none of them stands in for a real school. The data layer refuses to load a
          simulated row for a real school.
        </p>
      </Card>

      <Card title="Sources" id="src-h">
        <ul className="space-y-2 text-sm">
          {SOURCES.map((s) => (
            <li key={s.what}><span className="font-medium">{s.what}:</span> {s.url ? <a href={s.url} className="text-accent underline underline-offset-2">{s.who}</a> : s.who}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted">Full table with retrieval dates and known issues: <code>data/SOURCES.md</code> in the repository.</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Enrollment Vitality (real schools)" id="vit-h">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {VITALITY.filter((f) => f.weight > 0).map((f) => <li key={f.key}>{f.label}: weight {f.weight}</li>)}
          </ul>
          <p className="mt-2 text-xs text-muted">Each factor scores 0 at a &quot;concern&quot; value and 100 at a &quot;healthy&quot; value. Stable at {TIER_CUTS.stable}+, Watch {TIER_CUTS.watch}–{TIER_CUTS.stable - 1}, Turnaround candidate below {TIER_CUTS.watch}. This is the only score a real school gets.</p>
        </Card>
        <Card title="Composite (demo schools only)" id="comp-h">
          <p className="text-sm">Enrollment Vitality {COMPOSITE_WEIGHTS.vitality * 100}%, Financial {COMPOSITE_WEIGHTS.financial * 100}%, Facilities {COMPOSITE_WEIGHTS.facilities * 100}%. The Matrix plots enrollment trend against the financial score.</p>
        </Card>
        <Card title="Alert thresholds" id="thr-h">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li>Critical: enrollment trend since {schoolYear(BASE_YEAR)} at {THRESHOLDS.criticalCagr * 100}% a year or worse, or a one-year drop of {-THRESHOLDS.criticalChange1 * 100}% or more.</li>
            <li>Serious: {THRESHOLDS.seriousDeclines}+ straight years of decline and a trend of {THRESHOLDS.seriousCagr * 100}% a year or worse.</li>
            <li>Watch: other declines, grades under 15 students, and (demo only) re-enrollment and inquiry pacing.</li>
          </ul>
        </Card>
        <Card title="Scenarios" id="sc-h">
          <p className="text-sm">
            Two what-ifs make a range: the trend since {schoolYear(BASE_YEAR)} continues (capped at {SCENARIO_CAGR_CAP[0] * 100}% to +{SCENARIO_CAGR_CAP[1] * 100}%
            a year), or enrollment follows the local births curve. Shown as low–high, never as one number, and never in alerts.
          </p>
        </Card>
      </div>

      <p className="text-sm text-muted">
        Built by Matthew Poncini. <Link href="/about-me" className="text-accent underline underline-offset-2">Why I built this →</Link>
      </p>
    </div>
  );
}
