# School Vitality: independent prototype

A dashboard of operational health (enrollment, finance, facilities, data quality) for Catholic elementary schools in Santa Clara County, built as a portfolio piece.

> **Independent prototype by Matthew Poncini. Not affiliated with or endorsed by the Diocese of San José.**
> Most figures are currently **SAMPLE** (simulated) data and are badged as such in the UI. See `data/SOURCES.md`.

## Setup

```bash
npm install
npm run data      # rebuild data/schools.csv and regenerate data/sample/*
npm run dev       # http://localhost:3000
npm test          # Vitest
npm run build
```

## Data

- `data/raw/`: dated snapshots of public sources (directory, geocoder results).
- `data/schools.csv`: built by `scripts/build_schools.ts` from the snapshots. Any value not taken directly from the directory is logged in `data/corrections.csv`.
- `data/sample/`: SAMPLE data from `scripts/generate_sample.ts` (fixed seed, deterministic).
- `data/<name>.csv`: REAL data. Rows here replace SAMPLE rows with the same key, so real data can arrive one school or one year at a time.

All reads go through `lib/data.ts`, so moving from CSV files to a database later means changing that file only.

## Provenance rules

- Every value shows a **REAL** (solid, slate, ✓) or **SAMPLE** (dashed, amber, ◇) badge. Charts with SAMPLE data draw dashed lines.
- School names (and city) are hidden by default while enrollment is SAMPLE. The "Names" switch in the header changes this per viewer.
- No logos, seals or diocesan branding. No API keys in the repo.
