/**
 * A real school's page. Everything on it is public data (CDE enrollment and staffing,
 * CDPH births, the school's own tuition page, the public school directory). Internal
 * data (budgets, re-enrollment, facilities) isn't public, so it isn't shown here at all;
 * the demo pages show what this page looks like once that data exists.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertsCard, EnrollmentSections, TuitionCard, VitalityCard, stateDataLabel } from "@/components/school";
import { Tabs } from "@/components/Tabs";
import { Card, Stat } from "@/components/ui";
import { CDE_PUBLISHED } from "@/lib/config";
import { GOVERNANCE_LABEL, getMatchReview, getSchools, getStaffing, getTuitionReview, isDemoId } from "@/lib/data";
import { money, schoolYear, signedPct } from "@/lib/format";
import { displayName } from "@/lib/names";
import { realView } from "@/lib/system";

export function generateStaticParams() {
  return getSchools("default").map((s) => ({ id: s.id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = getSchools("default").find((x) => x.id === id);
  return { title: s ? `${s.name} · School Vitality Prototype` : "School Vitality Prototype" };
}

export default async function SchoolPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (isDemoId(id)) notFound();
  const v = realView().find((x) => x.school.id === id);
  if (!v) notFound();
  const { school, metrics: m } = v;
  const e = m.enrollment, f = m.finance;
  const L = e.latestYear;
  const name = displayName(school, "REAL");
  const staff = getStaffing().filter((x) => x.schoolId === id).sort((a, b) => a.year - b.year);
  const staffL = staff.at(-1);
  const match = getMatchReview().find((r) => r.schoolId === id);
  const tReview = getTuitionReview().find((r) => r.schoolId === id);
  const gradesL = e.byGrade.filter((g) => g.year === L);
  const firstStaffEnr = staff[0] ? e.series.find((x) => x.year === staff[0].year)?.total : undefined;

  const overview = (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={`Enrollment ${schoolYear(L)}`} value={e.latest ?? "—"} sub={`${signedPct(e.change1)} vs ${schoolYear(L - 1)}`} p="REAL" />
        <Stat label={`Change since ${schoolYear(e.baseYear)}`} value={signedPct(e.changeSinceBase)} sub={`${signedPct(e.cagr)} a year`} p="REAL" />
        <Stat label={`Full-time teachers ${staffL ? schoolYear(staffL.year) : ""}`} value={staffL?.ftTeachers ?? "—"}
          sub={staffL && e.latest ? `${(e.latest / staffL.ftTeachers).toFixed(1)} students each` : ""} p="REAL" />
        <Stat label={`Tuition${f.tuitionLatest ? ` ${schoolYear(f.tuitionLatest.year)}` : ""}`}
          value={f.tuitionLatest ? money(f.tuitionLatest.tuition) : <span className="text-muted">{f.tuitionUnverified ? money(f.tuitionUnverified.tuition) : "Not published"}</span>}
          sub={f.tuitionLatest ? `school's published standard rate${f.tuitionLatest.yearStated ? "" : "; year not stated on the page"}` : f.tuitionUnverified ? "third-party listing, unverified" : "school does not publish it"}
          p={f.tuitionLatest ? "REAL" : f.tuitionUnverified ? "UNVERIFIED" : "REAL"} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <VitalityCard v={v} />
        <AlertsCard alerts={v.alerts} demo={false} />
      </div>
      <Card title="About this school" id="loc-h">
        <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div><dt className="text-xs text-muted">Type</dt><dd>{GOVERNANCE_LABEL[school.governance]} <span className="text-xs text-muted">({school.governanceBasis})</span></dd></div>
          <div><dt className="text-xs text-muted">Grades in data</dt><dd>{gradesL.length ? `${gradesL[0].grade}–${gradesL.at(-1)!.grade}` : "—"}</dd></div>
          <div><dt className="text-xs text-muted">Address</dt><dd>{school.address}, {school.city} {school.zip}</dd></div>
          <div><dt className="text-xs text-muted">Phone</dt><dd>{school.phone}</dd></div>
          <div><dt className="text-xs text-muted">Website</dt><dd><a href={school.website} className="break-all text-accent underline underline-offset-2">{school.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</a></dd></div>
          {school.formerNames.length > 0 && <div><dt className="text-xs text-muted">Also listed as</dt><dd>{school.formerNames.join("; ")}</dd></div>}
          <div><dt className="text-xs text-muted">Source</dt><dd><a href={school.sourceUrl} className="text-accent underline underline-offset-2">School directory</a>, retrieved {school.retrieved}</dd></div>
        </dl>
      </Card>
      <p className="text-sm text-muted">
        Budgets, re-enrollment, admissions and facilities aren&apos;t public, so they aren&apos;t shown for real schools.{" "}
        <Link href="/demo" className="text-accent underline underline-offset-2">See how a school page looks with that data</Link> (fictional demo schools).
      </p>
    </div>
  );

  const enrollment = (
    <div className="space-y-6">
      <EnrollmentSections v={v} />
      {staffL && (
        <Card title={`Staffing, ${schoolYear(staffL.year)}`} id="en-staff">
          <dl className="grid grid-cols-2 gap-3 text-sm tabular sm:grid-cols-4">
            <div><dt className="text-xs text-muted">Full-time teachers</dt><dd className="text-xl font-semibold">{staffL.ftTeachers}</dd><dd className="text-xs text-muted">{staffL.ptTeachers} part-time</dd></div>
            <div><dt className="text-xs text-muted">Students per full-time teacher</dt><dd className="text-xl font-semibold">{e.latest && staffL.ftTeachers ? (e.latest / staffL.ftTeachers).toFixed(1) : "—"}</dd>
              {staff.length > 1 && firstStaffEnr && staff[0].ftTeachers ? <dd className="text-xs text-muted">{(firstStaffEnr / staff[0].ftTeachers).toFixed(1)} in {schoolYear(staff[0].year)}</dd> : null}</div>
            <div><dt className="text-xs text-muted">Administrators</dt><dd className="text-xl font-semibold">{staffL.admins}</dd></div>
            <div><dt className="text-xs text-muted">Other staff</dt><dd className="text-xl font-semibold">{staffL.otherStaff}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted">Reported by the school on the CDE affidavit.</p>
        </Card>
      )}
    </div>
  );

  const tuition = (
    <div className="grid gap-6 lg:grid-cols-2">
      <TuitionCard f={f} review={tReview} />
      <Card title="How tuition is collected" id="fi-how">
        <p className="text-sm text-muted">
          Rates come from each school&apos;s own tuition page. A rate found only on a third-party site (for example Niche) is shown as
          unverified and left out of every median. Where nothing is published, nothing is estimated.
        </p>
      </Card>
    </div>
  );

  const quality = (
    <div className="space-y-6">
      <Card title="Enrollment file (CDE)" id="dq1">
        {match ? (
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted">Name in the CDE file</dt><dd>{match.cdeName}</dd></div>
            <div><dt className="text-xs text-muted">CDS code</dt><dd className="tabular">{match.cdsCode}</dd></div>
            <div><dt className="text-xs text-muted">Years</dt><dd>{match.years}</dd></div>
            <div><dt className="text-xs text-muted">Matched by</dt><dd>{match.matchBasis}</dd></div>
            {match.formerCdeNames.length > 0 && <div className="sm:col-span-2"><dt className="text-xs text-muted">Earlier names in the file</dt><dd>{match.formerCdeNames.join("; ")}</dd></div>}
          </dl>
        ) : <p className="text-sm text-muted">No CDE match recorded.</p>}
        <h3 className="mt-4 text-sm font-semibold">Checks</h3>
        {match && match.issues.length ? (
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{match.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        ) : <p className="mt-1 text-sm text-muted">No gaps, jumps or grade-sum mismatches found.</p>}
        <p className="mt-3 text-xs text-muted">
          Each year is checked for a missing row, a total that changes by more than 30% in a year, and a reported total that doesn&apos;t
          match the sum of grades K–8. Totals on this site are the grade sums. Flags go back to the school to confirm, not corrected here.
        </p>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Births file (CDPH)" id="dq2">
          <p className="text-sm">Catchment: {m.market.catchmentZips.length} ZIP codes within 4 miles ({m.market.catchmentZips.join(", ")}), births {m.market.births[0]?.year}–{m.market.latestBirthYear}.</p>
          <p className="mt-2 text-xs text-muted">Births are counted by the mother&apos;s ZIP of residence. Catchments overlap and differ in size, so compare a school with itself over time, not with other schools.</p>
        </Card>
        <Card title="Tuition" id="dq3">
          <p className="text-sm">{f.tuitionLatest ? (f.tuitionLatest.yearStated ? "Published on the school's site, year stated." : "Published on the school's site; the year isn't stated on the page.") : f.tuitionUnverified ? "Only a third-party listing was found (unverified)." : "Not published."}</p>
          {tReview?.notes && <p className="mt-2 text-xs text-muted">{tReview.notes}</p>}
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-xs text-muted"><Link href="/" className="underline underline-offset-2">Radar</Link> / School</nav>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight" title={school.formerNames.length ? `Also listed as: ${school.formerNames.join("; ")}` : undefined}>{name}</h1>
        <p className="text-sm text-muted">{GOVERNANCE_LABEL[school.governance]} · {school.city} · {stateDataLabel(CDE_PUBLISHED)}</p>
      </div>
      <Tabs tabs={[
        { id: "overview", label: "Overview", content: overview },
        { id: "enrollment", label: "Enrollment", content: enrollment },
        { id: "tuition", label: "Tuition", content: tuition },
        { id: "data", label: "Data quality", content: quality },
      ]} />
    </div>
  );
}
