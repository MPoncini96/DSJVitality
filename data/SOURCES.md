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
| Latitude/longitude | US Census Geocoder, benchmark `Public_AR_Current` | https://geocoding.geo.census.gov/geocoder/ | Current | 2026-10-16 | Snapshot: `raw/geocode_census_2026-10-16.csv`. One ambiguous match (St. Nicholas, El Monte Rd vs. Ave) is flagged for review. |

## Not from a source (flagged for review)

| Field | Basis |
|---|---|
| `governance` in `schools.csv` | Inferred. The directory does not say which schools are parish elementary schools, diocesan high schools, or run by a religious order or an independent board. The 25 parish-elementary classification matches the job posting's "all 25 diocesan Catholic schools" but is **unverified**. Overrides: `raw/governance_2026-10-16.csv`. |
| `grades`, `parish` | Left blank. Not published on the directory; to be filled from the CDE Private School Affidavit. |

## SAMPLE (to be replaced)

| File | Planned REAL source |
|---|---|
| `sample/enrollment.csv` | California Department of Education, Private School Affidavit data files (enrollment by grade, annual); NCES Private School Survey as a cross-check |
| `sample/tuition.csv` | Each school's published tuition page (current year; history via Internet Archive where available). Blank where not published. |
| `sample/demographics.csv` | US Census ACS 5-year, by ZCTA: ages 5–14 (B01001), median household income (B19013) |
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
