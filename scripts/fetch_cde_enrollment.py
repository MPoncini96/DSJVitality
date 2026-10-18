#!/usr/bin/env python3
"""Refresh REAL enrollment data for the 25 Diocese of San Jose parish elementary schools.

Source: California Department of Education, Private School Affidavit data files
        https://www.cde.ca.gov/ds/si/ps/
Run yearly after CDE publishes the new affidavit file (filing window is Oct 1-15;
the file usually posts a few weeks to months later).

    pip install requests openpyxl
    python scripts/fetch_cde_enrollment.py --out data/raw/cde_enrollment_YYYY-MM-DD.json
    npm run data:cde     # validate and import into data/enrollment.csv

Writes the same shape as data/raw/cde_enrollment_2026-10-18.json.
"""
import argparse, io, json, datetime
import requests, openpyxl

BASE = "https://www.cde.ca.gov/ds/si/ps/documents/privateschooldata{yy}.xlsx"
# First year with an .xlsx file on CDE is 2019-20 (older years are .xls / a different page).
FIRST_YEAR = 2019

# slug (matches /schools/<slug> in the app) -> 14-digit CDS code
SCHOOLS = {
    "holy-family": "43696667019169", "holy-spirit": "43696667101579",
    "most-holy-trinity": "43693696979371", "queen-of-apostles": "43694196979421",
    "sacred-heart-saratoga": "43696826979462", "st-catherine": "43695836980403",
    "st-christopher": "43696666980411", "st-clare": "43696746980429",
    "st-elizabeth-seton": "43696416979470", "st-frances-cabrini": "43693856980445",
    "st-john-the-baptist": "43733877028806", "st-john-vianney": "43693696980452",
    "st-joseph-cupertino": "43694196980460", "st-joseph-mv": "43695916980478",
    "st-justin": "43696746980494", "st-lawrence": "43696746980502",
    "st-leo": "43696666980510", "st-lucy": "43693936980528",
    "st-martin-of-tours": "43693936980544", "st-mary-los-gatos": "43695266980551",
    "st-mary-gilroy": "43694846966147", "st-nicholas": "43695186980213",
    "st-patrick": "43696666980221", "st-simon": "43694196980239",
    "st-victor": "43693776980247",
}
GRADES = ["K", "1", "2", "3", "4", "5", "6", "7", "8"]
STAFF = {"ft_teachers": "Full Time Teachers", "pt_teachers": "Part Time Teachers",
         "admins": "Administrators", "other_staff": "Other Staff"}


def num(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def load_year(start):
    yy = f"{start % 100:02d}{(start + 1) % 100:02d}"
    r = requests.get(BASE.format(yy=yy), timeout=60)
    if r.status_code == 404:
        return None
    r.raise_for_status()
    ws = openpyxl.load_workbook(io.BytesIO(r.content), read_only=True, data_only=True).worksheets[0]
    rows = list(ws.iter_rows(values_only=True))
    hi = next(i for i, row in enumerate(rows) if row and row[0] == "CDS Code")
    head = [str(h).strip() if h else "" for h in rows[hi]]
    by_cds = {}
    for row in rows[hi + 1:]:
        if row and row[0]:
            rec = dict(zip(head, row))
            by_cds[str(rec["CDS Code"]).strip()] = rec
    return f"{start}-{(start + 1) % 100:02d}", by_cds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="data/enrollment.json")
    args = ap.parse_args()

    years, start = [], FIRST_YEAR
    while True:
        got = load_year(start)
        if not got:
            break
        years.append(got)
        start += 1

    out = {"source": {"name": "California Department of Education — Private School Affidavit data files",
                      "url": "https://www.cde.ca.gov/ds/si/ps/",
                      "retrieved": datetime.date.today().isoformat()},
           "schools": {}, "system": {"total_by_year": {}}}
    for slug, cds in SCHOOLS.items():
        hist, names = [], []
        for label, by_cds in years:
            r = by_cds.get(cds)
            if not r:
                continue
            nm = str(r["School Name"]).strip()
            if nm not in names:
                names.append(nm)
            h = {"year": label, "total": num(r.get("Total Enrollment"))}
            h.update({g: num(r.get(f"Grade {g} Enroll")) for g in GRADES})
            h.update({k: num(r.get(col)) for k, col in STAFF.items()})
            hist.append(h)
            out["system"]["total_by_year"][label] = out["system"]["total_by_year"].get(label, 0) + (h["total"] or 0)
        if not hist:
            print(f"WARNING: {slug} ({cds}) not found in any year")
            continue
        out["schools"][slug] = {"cds_code": cds, "name": names[-1], "former_names": names[:-1],
                                "public_district": str(by_cds.get(cds, {}).get("Public School District", "")),
                                "history": hist}
        if hist[-1]["year"] != years[-1][0]:
            print(f"WARNING: {slug} missing from latest year {years[-1][0]}")

    with open(args.out, "w") as f:
        json.dump(out, f, indent=1)
    print(f"Wrote {args.out}: {len(out['schools'])} schools, years {years[0][0]}..{years[-1][0]}")


if __name__ == "__main__":
    main()
