# School Vitality: independent prototype

A dashboard of operational health (enrollment, finance, facilities, data quality) for Catholic elementary schools in Santa Clara County, built as a portfolio piece.

> **Independent prototype by Matthew Poncini. Not affiliated with or endorsed by the Diocese of San José.**
> Most figures are currently **SAMPLE** (simulated) data and are badged as such in the UI. See `data/SOURCES.md`.

## Setup

```bash
npm install
npm run data      # schools, CDE enrollment, CDPH births, published tuition, then data/sample/*
npm run dev       # http://localhost:3000
npm test          # Vitest
npm run build
```

## Pages

- **Radar** (`/`): system figures, alert counts by area, the Enrollment & Finance Matrix, upcoming deadlines, Turnaround check-ins, and the enrollment trend and school table.
- **Alerts** (`/alerts`): every school with an item that needs attention, worst first, filterable by area, plus the rules that raise them.
- **Turnaround Program** (`/turnaround`): the process (identify, assess, plan, implement, monitor, exit), the roster, schools flagged but not enrolled, and action plans with owners and due dates.
- **School profile** (`/schools/[id]`): overview with score breakdowns, then enrollment, finance and tuition, facilities, and data quality tabs.

## Scores and alerts

- `lib/metrics.ts` computes each school's numbers. `lib/health.ts` turns them into scores; every factor, threshold and weight is written out there and shown on the school page.
- **Enrollment Vitality** uses only REAL inputs: 5-year enrollment trend, 1-year change, cohort retention, kindergarten share of local births (trend) and births within 4 miles (5-year change). The **Composite** adds finance and facilities and stays illustrative.
- **Projections** (PROJECTED badge) run through 2029-30 from births already on record and real grade-to-grade rates.
- `lib/radar.ts` holds the alert rules. Thresholds are starting points, not policy.
- A risk flag (alert, tier, quadrant, Turnaround status) built on SAMPLE data never shows a real school name, even when the Names switch is on.

## Data

- `data/raw/`: dated snapshots of public sources (directory, geocoder results).
- `data/schools.csv`: built by `scripts/build_schools.ts` from the snapshots. Any value not taken directly from the directory is logged in `data/corrections.csv`.
- `data/sample/`: SAMPLE data from `scripts/generate_sample.ts` (fixed seed, deterministic).
- `data/<name>.csv`: REAL data. Rows here replace SAMPLE rows with the same key, so real data can arrive one school or one year at a time. For enrollment, a school with any REAL rows has its whole SAMPLE series dropped.
- `data/enrollment.csv`, `data/staffing.csv`: REAL, from the CDE Private School Affidavit. To refresh each year after CDE posts the new file:

  ```bash
  pip install requests openpyxl
  python scripts/fetch_cde_enrollment.py --out data/raw/cde_enrollment_$(date +%F).json
  npm run data      # validates, writes enrollment.csv / staffing.csv / match_review.csv, rescales SAMPLE data
  ```

  The import stops with a list of problems if any value fails validation (non-integer counts, unknown schools, malformed years). Review `data/match_review.csv` after each refresh.

All reads go through `lib/data.ts`, so moving from CSV files to a database later means changing that file only.

## Provenance rules

- Every value shows a **REAL** (solid, slate, ✓) or **SIMULATED** (dashed, amber, ◇) badge. Charts with simulated data draw dashed lines. (In the data files and code the tag is `SAMPLE`.)
- Real school names are shown everywhere. Flags and scores that rest on simulated data carry a SIMULATED badge, an "illustrative" label, or a ◇ marker next to the school name.
- No logos, seals or diocesan branding. No API keys in the repo.
