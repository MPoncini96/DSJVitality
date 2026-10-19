# Data sources

Every metric in this prototype carries a provenance tag:

- **REAL**: taken from a public source listed below.
- **SAMPLE**: simulated by `scripts/generate_sample.ts` (fixed seed `20261016`). Not real figures for any school.

REAL files live in `data/`. SAMPLE files live in `data/sample/`. When both have a row with the same key, the REAL row wins (see `lib/data.ts`).

## REAL

| Dataset | Source | URL | Data year | Retrieved | Notes |
|---|---|---|---|---|---|
| School list (`schools.csv`): name, website, address, city, ZIP, phone | Diocese of San José, "Find a School" | https://www.dsj.org/find-a-school/ | Current listing | 2026-10-16 | 33 schools. Snapshot: `raw/dsj_find_a_school_2026-10-16.csv`. One ZIP is blank on the page (St. Mary of the Immaculate Conception, Los Gatos) and was filled from the geocoder; see `corrections.csv`. |
| Private School Affidavit filing window (Oct 1–15), shown on the Radar calendar | California Department of Education | https://www.cde.ca.gov/SP/PS/affidavit.asp | Statutory (Education Code §33190) | 2026-10-18 | Other calendar items are typical timings, marked SAMPLE. |
| Enrollment by grade, K–8 (`enrollment.csv`) and staffing (`staffing.csv`), 25 parish schools, 2019-20 to 2025-26 | California Department of Education, Private School Affidavit data files | https://www.cde.ca.gov/ds/si/ps/ | 2019-20 – 2025-26 | 2026-10-18 | Snapshot: `raw/cde_enrollment_2026-10-18.json`, written by `scripts/fetch_cde_enrollment.py` and imported by `scripts/import_cde_enrollment.ts`. Schools matched by 14-digit CDS code. Self-reported each October by schools with 6+ students. 2026-27 affidavits (filed Oct 1–15, 2026) are not yet published. See `match_review.csv` for flagged items. |
| Births by year near each school (`births.csv`, 2005–2024) and county totals (`county_births.csv`) | California Department of Public Health, Final Births by Year by ZIP Code (mother's residence), via CHHS Open Data | https://data.chhs.ca.gov/dataset/live-birth-profiles-by-zip-code | 2005–2024 | 2026-10-18 | Snapshot: `raw/cdph_births_catchment_2026-10-18.json`; imported by `scripts/import_births.ts`. Catchment = ZIPs whose Census 2023 ZCTA centroid is within 4 miles of the school's ZIP centroid. Catchments overlap and differ in size: compare a school with itself over time, never sum schools. Suppressed small counts treated as 0. |
| Published tuition (`tuition.csv`) | Each school's own tuition page or PDF (URL per row) | per row | 2026-27 (two prior-year rates quoted on the same pages) | 2026-10-18 | Snapshot: `raw/tuition_published_2026-10-18.json`; imported by `scripts/import_tuition.ts`. Standard and parishioner rates kept separately; fees and discounts in `notes`. Two pages do not state the year (St. Lawrence, St. Victor) and are flagged. Third-party listings are in `tuition_unverified.csv`, shown labeled UNVERIFIED and excluded from all calculations. Four schools publish nothing and are left blank (`tuition_review.csv`). |
| Latitude/longitude | US Census Geocoder, benchmark `Public_AR_Current` | https://geocoding.geo.census.gov/geocoder/ | Current | 2026-10-16 | Snapshot: `raw/geocode_census_2026-10-16.csv`. One ambiguous match (St. Nicholas, El Monte Rd vs. Ave) is flagged for review. |

## Not from a source (flagged for review)

| Field | Basis |
|---|---|
| `governance` in `schools.csv` | Inferred. The directory does not say which schools are parish elementary schools, diocesan high schools, or run by a religious order or an independent board. The 25 parish-elementary classification matches the job posting's "all 25 diocesan Catholic schools" but is **unverified**. Overrides: `raw/governance_2026-10-16.csv`. |
| `grades`, `parish` | Left blank. Not published on the directory; to be filled from the CDE Private School Affidavit. |

## SAMPLE (to be replaced)

| File | Planned REAL source |
|---|---|
| `sample/enrollment.csv` | Now REAL for the 25 parish schools (see above); SAMPLE rows remain only for the 8 high schools and order-run/independent schools. A school with any REAL enrollment has its SAMPLE series dropped entirely. Next: CDE `.xls` files before 2019-20 for a 10-year history; NCES Private School Survey as a cross-check. |
| `sample/tuition.csv` | Now only for the 8 non-parish schools. Parish schools use published rates, or show blank/unverified; budgets for schools without a published rate are scaled off an unverified listing or a simulated value, never displayed as tuition. |
| `sample/demographics.csv` | No longer used in scores or pages; replaced by CDPH births. ACS income by ZCTA remains a possible addition. |
| `sample/budget_actual.csv` | No public source. Stays SAMPLE. |
| `sample/tuition_assistance.csv` | No public source. Stays SAMPLE ("TADS-style"). |
| `sample/pipeline.csv` | No public source. Stays SAMPLE. |
| `sample/facilities.csv` | No public source. Stays SAMPLE. |
| `sample/data_audit.csv` | No public source. Stays SAMPLE. |
| `sample/reenrollment.csv` | No public source (school systems). Stays SAMPLE. Cohort retention, computed from state grade-level enrollment, is the public-source stand-in used in the Enrollment Vitality score. |
| `sample/cash_monthly.csv`, `sample/receivables.csv` | No public source. Stays SAMPLE. |
| `sample/turnaround.csv`, `sample/turnaround_actions.csv` | Illustrative program roster and action plans. Stays SAMPLE. |

School size in the SAMPLE enrollment is assigned at random from generic bands (small 140–210, medium 210–300, large 300–420 students for elementary schools); it is **not** an estimate of any real school's size.

## The sample "as of" date

SAMPLE data describes a system as of **October 1, 2026**: fall 2026 enrollment is in, fiscal year 2026 (July 2025–June 2026) is closed, and FY2027 has three months of actuals (July–September).

## Known issues in the REAL enrollment (also in `match_review.csv`)

- **St. Joseph of Cupertino** has no record in the 2022-23 file. System totals carry its 2021-22 value forward for that year, and the chart says so.
- **St. Martin of Tours and St. Nicholas, 2019-20:** the reported total is higher than the sum of grades K–8 (by 31 and 19), most likely TK or ungraded students. The dashboard uses the K–8 grade sum everywhere.
- **Large one-year swings** (St. Joseph of Cupertino 2021-22→2023-24, St. Justin 2023-24→2024-25, St. Lawrence 2021-22→2022-23) are reported as filed; worth confirming with the schools.
- Names differ between the directory and CDE for several schools (e.g. "St. Lawrence Elementary and Middle School" vs "St. Lawrence School"). Matching is by CDS code, not name.

## Projections (labeled PROJECTED)

Enrollment projections for 2026-27 through 2029-30 are computed in `lib/metrics.ts` from REAL inputs only:
kindergarten = the school's 3-year average share of local births × births five years earlier; other grades = the prior grade × the 3-year pooled continuation ratio (capped at 0.75–1.25). Projections for schools under 100 students, with capped ratios, or with fewer than 5 years of kindergarten data are marked low-confidence and do not raise alerts.
