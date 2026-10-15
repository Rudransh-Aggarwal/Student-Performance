# data-service

Holds the academic data (modules, students, enrollments, assessments, results, weekly activity) in MongoDB.

## Dataset: Open University Learning Analytics Dataset (OULAD)

A real, anonymised dataset from the UK Open University, released under **CC BY 4.0**
(you must credit it; keep the citation below in your report).

> Kuzilek J., Hlosta M., Zdrahal Z. Open University Learning Analytics dataset. Sci. Data 4:170171 (2017). doi:10.1038/sdata.2017.171

1. Open https://research.stem.open.ac.uk/ouanalyse/open-dataset-more/ and click **Download dataset**
   (a mirror listing also exists on the UCI repository: "Open University Learning Analytics Dataset").
2. Unzip and copy these files into `data/oulad/`:
   `courses.csv`, `assessments.csv`, `studentInfo.csv`, `studentRegistration.csv`, `studentAssessment.csv`, `studentVle.csv`
   (`vle.csv` is not needed).

## Import a sample

```
cp .env.example .env          # Windows: Copy-Item .env.example .env
npm install
npm run import:oulad -- --students 1000 --reset
```

Options: `--dir` (CSV folder), `--students` (sample size), `--seed` (same seed = same students), `--reset` (wipe and re-import).

What the importer does:
- Samples ~1,000 of the ~32,000 students, keeping all of their module registrations.
- Sums the ~10 million daily click rows into one row per student, module and week.
- Skips assessment rows without a score.
- Does NOT import gender, region, deprivation band or disability (sensitive; the models should not use them).

`npm test` runs the parsing and sampling tests (no database or dataset needed).

## Student prediction features

The authenticated student endpoint `GET /api/data/demo-accounts/me/prediction-features` uses the Firebase UID-to-demo-student link to aggregate that student's imported enrollments, scored assessment results, assessment definitions and weekly activity. It returns normalized assessment score, active-day engagement and assessment completion features; a feature is `null` when the imported records do not contain enough data for it. The frontend only sends complete feature sets to the ML service.

## Export training data for the ML service

`npm run export:training -- --students 1000 --seed 42` writes `ml-service/data/training_features.csv` (one row per student: the three prediction features plus `at_risk`) and a `.meta.json` sidecar. It uses the same feature calculation as the live endpoint. It does not need MongoDB.
