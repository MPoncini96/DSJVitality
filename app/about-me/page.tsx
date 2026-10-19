import { existsSync } from "node:fs";
import { join } from "node:path";
import Link from "next/link";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Why I built this · School Vitality Prototype" };

// DRAFT: Matthew to edit. Facts below are from his resume; wording is a starting point.
const DUTIES: { duty: string; where: { label: string; href: string }[]; note?: string }[] = [
  { duty: "Monthly enrollment reports for the Department of Catholic Schools", where: [{ label: "Radar", href: "/" }, { label: "Enrollment tab on each school", href: "/schools/holy-family#enrollment" }] },
  { duty: "Enrollment & Finance Matrix", where: [{ label: "Matrix (Radar, demo section)", href: "/#matrix-h" }] },
  { duty: "Turnaround Program: identify, plan, monitor, exit", where: [{ label: "Turnaround", href: "/turnaround" }] },
  { duty: "TADS and data integrity across schools", where: [{ label: "Data quality tab", href: "/schools/holy-family#data" }, { label: "Demo data feeds", href: "/demo/schools/demo-a#data" }] },
  { duty: "Facilities guidelines and capital planning", where: [{ label: "Facilities tab (demo)", href: "/demo/schools/demo-a#facilities" }] },
  { duty: "Dashboards for pastors, principals and the Chancery", where: [{ label: "The whole site", href: "/" }], note: "Built in Next.js to show the logic; the same data model and formulas port directly to Power BI." },
];

export default function AboutMe() {
  const resume = existsSync(join(process.cwd(), "public", "resume.pdf"));
  return (
    <div className="space-y-8">
      <PageHeader title="Why I built this" />

      <Card id="who-h" title="Who built it">
        <p className="max-w-3xl text-sm">
          I&apos;m Matthew Poncini. I taught math, statistics and programming at ICA Cristo Rey in San Francisco for four years, served six
          years in the Army National Guard as a calibration specialist, and recently finished an M.S. in Computer Science at the University
          of Louisville. I built this prototype to show how I would approach the Director of School Operational Vitality role: start from the
          public data, be honest about what it can and can&apos;t say, and give pastors and principals one clear place to look.
        </p>
      </Card>

      <Card id="map-h" title="The job posting, mapped to this site">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr><th scope="col" className="py-2 pr-4 text-left font-medium">Responsibility</th><th scope="col" className="py-2 text-left font-medium">Where it is</th></tr>
            </thead>
            <tbody>
              {DUTIES.map((d) => (
                <tr key={d.duty} className="border-b border-border align-top last:border-0">
                  <td className="py-2 pr-4">{d.duty}</td>
                  <td className="py-2">
                    {d.where.map((w, i) => <span key={w.href}>{i > 0 && " · "}<Link href={w.href} className="text-accent underline underline-offset-2">{w.label}</Link></span>)}
                    {d.note && <span className="block text-xs text-muted">{d.note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card id="ninety-h" title="First 90 days">
        <ul className="list-disc space-y-2 pl-5 text-sm">
          <li><strong>Listen first.</strong> Visit every school, meet each pastor and principal, and agree on which numbers matter to them.</li>
          <li><strong>Get one clean data set.</strong> Confirm enrollment, tuition and assistance figures with each school and set a monthly reporting rhythm with the Department.</li>
          <li><strong>Put the Matrix to work.</strong> Run the first Enrollment &amp; Finance Matrix on real data and start Turnaround conversations with the schools that need them most.</li>
        </ul>
      </Card>

      <Card id="links-h" title="Contact">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {resume && <li><a href="/resume.pdf" className="text-accent underline underline-offset-2">Resume (PDF)</a></li>}
          <li><a href="https://www.linkedin.com/in/matt-poncini" className="text-accent underline underline-offset-2">LinkedIn</a></li>
          <li><a href="mailto:mjpon8896@gmail.com" className="text-accent underline underline-offset-2">mjpon8896@gmail.com</a></li>
        </ul>
      </Card>
    </div>
  );
}
