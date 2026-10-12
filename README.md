# Intelligent Student Performance Prediction System

A capstone prototype that flags students who may need support, based on sampled OULAD (Open University Learning Analytics Dataset, CC BY 4.0) learning activity and assessment data.

> **Limitations:** The risk estimate is retrospective. It uses whole-course data to predict end-of-course outcomes, so it is not an early-warning system. It has not been externally validated. Do not use it for decisions about real students.

## Features

| Role | Capabilities |
|---|---|
| Student | Sign in, link their own demo student ID, see their outlook, strengths and improvement points for enrolled modules |
| Instructor | See only the modules assigned to them, cohort tables with outcome filtering and sorting, individual student detail |
| Admin | Assign modules to instructors, change roles between student and instructor, unlink student accounts, view the audit log |

Anyone can self-register as a student or instructor. Admin accounts are created only with the seed script.

## Documentation

| Document | Contents |
|---|---|
| [docs/USER_GUIDE.md](docs/USER_GUIDE.md) | How students, instructors and admins use the app |
| [docs/API.md](docs/API.md) | Every HTTP endpoint, with auth, request and error details |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | MongoDB collections and how they relate |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Environment variables, Docker Compose, minikube |

## Architecture

| Service | Stack | Port | Responsibility |
|---|---|---|---|
| frontend | React 19, Vite, Tailwind v4 (JavaScript) | 5173 (Compose), 3000 (minikube) | Landing page, auth pages, role dashboards, admin tools |
| auth-service | Express 5, Mongoose, Firebase Admin | 4000 | Profiles, roles, one-time role choice for social sign-ups, admin role management, logout |
| data-service | Express 5, Mongoose | 4100 | OULAD data, modules, enrollments, demo-account links, module assignments, audit log, prediction features |
| ml-service | FastAPI, scikit-learn | 5000 | Risk scoring (`risk-v2` logistic regression, rule-based fallback), model health |
| MongoDB | MongoDB 7 | 27017 | All application data |
| Identity | Firebase Auth | n/a | Email/password, Google and GitHub sign-in |

Design decisions:
- Plain JavaScript (no TypeScript) for frontend and backend.
- REST only. Separate services for auth, data and ML.
- Firebase owns identity. Roles live in MongoDB, keyed by Firebase UID.
- A role is read when a profile is created. Users cannot change their own role. Admins can change roles for students and instructors only.
- Demoting an account from instructor clears its module assignments, and every role change is written to the audit log.
- `completion_rate` is excluded from the trained model because it leaks the outcome (it is closely tied to withdrawal).
- Target: at risk if any enrollment ended in Fail or Withdrawn.

## Repository layout

```
student-performance-system/
├── frontend/          React + Vite app; Dockerfile builds it and serves it with Nginx
├── auth-service/      Profiles, roles, Firebase Admin, seed and migration scripts
├── data-service/      OULAD import, modules, enrollments, assignments, audit log, training export
├── ml-service/        FastAPI model serving, training script, tests
├── k8s/               Kubernetes manifests for minikube
├── docs/              API, data model, user guide, deployment
└── docker-compose.yml
```

## Quick start (Docker Compose)

1. Copy `.env.example` to `.env` in the project root and fill in `FIREBASE_PROJECT_ID` and the `VITE_FIREBASE_*` values from the Firebase console (Project settings).
2. Stop the local MongoDB Windows service if it is running (port 27017 conflict).
3. Generate the model and the training data (see below). The model file is git-ignored, so each machine needs its own copy.
4. Start everything:
   ```
   docker compose up -d --build
   ```
5. Open http://localhost:5173.

Rebuild with `--build` after code, dependency or `VITE_*` changes. Changes to runtime-only `.env` values need only `docker compose up -d`.

For Kubernetes (minikube), see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Local development without Docker

Requires Node 22, and MongoDB running locally or via `docker compose up -d mongo`.

```
cd auth-service  && npm install && npm run dev    # port 4000
cd data-service  && npm install && npm run dev    # port 4100
cd frontend      && npm install && npm run dev    # port 5173
```

The ML service runs in a Python 3.14 virtual environment:

```
cd ml-service
python -m venv .venv
.venv\Scripts\activate            # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 5000
```

## Data and model setup

1. Download the OULAD dataset and place the CSV files in `data-service/data/oulad/` (see `data-service/README.md`). The CSVs are not included in the repository.
2. Import a sample of students:
   ```
   cd data-service
   npm run import:oulad -- --students 1000 --reset
   ```
3. Export the training features and train the model:
   ```
   npm run export:training -- --students 1000 --seed 42
   cd ../ml-service
   python training/train.py --data data/training_features.csv --models-dir models --version v2
   ```
4. Create the first admin account:
   ```
   cd auth-service
   npm run seed:admin
   ```
   This needs a Firebase service account key, supplied through `GOOGLE_APPLICATION_CREDENTIALS` (keep it outside the repository).

Check the model with `GET http://localhost:5000/model/health`. It should report `risk-v2` as loaded.

## Testing

| Suite | Command | Result |
|---|---|---|
| auth-service | `npm test` | 20 pass |
| data-service | `npm test` | 45 pass |
| ml-service | `python -m pytest -q` | 6 pass |
| frontend | `npm run build` | Passes (no automated tests yet) |

Not yet covered by tests: the data-service internal role-change route and `recordRoleChange`, and the real `getStudentDetail` function (currently stubbed).

## Known limitations

- Demo-account linking is not restricted: any student can link any unlinked demo ID. Acceptable for a test project; restrict before real use.
- The audit log records unlinks and role changes, but writes are not atomic with the change they record.
- If a role change succeeds but its audit or cleanup step fails, the API returns `ROLE_SYNC_FAILED` and the admin should retry. A retry after a lost response can add a duplicate audit entry.
- Access tokens remain valid for up to one hour after logout.
- The auth middleware calls auth-service on every request, so role changes take effect on the next request.
- No automated frontend tests. The landing page has no footer, and pages have no document titles.
- The team section uses the project team's photos and links.
- The model is retrospective and not externally validated.

## Dataset

Open University Learning Analytics Dataset (OULAD), released under CC BY 4.0. Cite it as: Kuzilek J., Hlosta M., Zdrahal Z. Open University Learning Analytics dataset. Sci. Data 4:170171 (2017). doi:10.1038/sdata.2017.171
