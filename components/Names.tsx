import Link from "next/link";
import { schoolHref } from "@/lib/names";
import type { School } from "@/lib/types";

/** A link to a school's page: a real school's page or a demo school's page. */
export function SchoolLink({ id, name, school, title }: { id?: string; name?: string; school?: School; title?: string }) {
  const href = school ? schoolHref(school) : id!.startsWith("demo-") ? `/demo/schools/${id}` : `/schools/${id}`;
  const label = school?.name ?? name;
  const tip = title ?? (school?.formerNames.length ? `Also listed as: ${school.formerNames.join("; ")}` : undefined);
  return (
    <Link href={href} title={tip} className="font-medium text-text underline decoration-border underline-offset-2 hover:decoration-accent">
      {label}
    </Link>
  );
}
