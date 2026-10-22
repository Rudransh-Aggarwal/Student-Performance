# API Reference

Every endpoint returns JSON. Errors use the shape `{ "error": ... }`. Auth-service errors use `{ "error": { "code", "message" } }`; data-service errors use `{ "error": "<message>" }` and may include `details`.

## Authentication

| Header | Used by | Meaning |
|---|---|---|
| `Authorization: Bearer <Firebase ID token>` | Browser clients | Identifies the user. The token is verified server-side; the role comes only from the database. |
| `X-Service-Auth: <AUTH_SERVICE_SECRET>` | Service-to-service calls | Internal endpoints only. |

Browser requests reach the services through the frontend's Nginx (or Vite in development) on the same origin: `/api/auth`, `/api/data` and `/ml`.

Common status codes: 400 invalid input, 401 missing or invalid token, 403 wrong role or no profile, 404 not found, 409 conflict, 502 or 503 a dependency is unavailable.

## auth-service (port 4000)

Mounted at `/api/auth`.

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/session` | Token | Verify the token and return the profile, creating it on first sign-in. Optional body: `{ name?, role?: "student" \| "instructor" }`. The role is used only when the profile is created. Social sign-ups from the Login page are created with `roleSelectionPending: true`. |
| GET | `/me` | Token | The current user. |
| POST | `/role` | Token | One-time role choice for pending social sign-ups. Body: `{ role }` with `student` or `instructor`. 409 `ROLE_ALREADY_SET` if the choice was already made. |
| POST | `/logout` | Token | Revokes the user's Firebase refresh tokens. Returns 204. Access tokens stay valid until they expire (up to one hour). |
| GET | `/admin/users` | Admin | All accounts, sorted by name (up to 1000). Each item includes `firebaseUid`. |
| PATCH | `/admin/users/:firebaseUid/role` | Admin | Change a student's or instructor's role. Body: `{ role: "student" \| "instructor" }`. Returns the updated user. |

Errors for `PATCH /admin/users/:firebaseUid/role`:

| Status | Code | Cause |
|---|---|---|
| 400 | `CANNOT_CHANGE_OWN_ROLE` | Admin targeted their own account |
| 400 | (validation) | Role is not `student` or `instructor`; admin cannot be assigned here |
| 403 | `ADMIN_ROLE_PROTECTED` | Target is an admin account |
| 404 | `USER_NOT_FOUND` | No profile for that UID |
| 409 | `ROLE_UPDATE_CONFLICT` | The account changed during the update; retry |
| 502 | `ROLE_SYNC_FAILED` | The role was saved, but data-service could not record the audit entry or clear module assignments. Retry the change. |

Service-only routes (require `X-Service-Auth`; used by data-service):

| Method | Path | Purpose |
|---|---|---|
| GET | `/user/:firebaseUid` | Public profile (including role) for one user. 404 if none. |
| GET | `/users?role=student\|instructor` | Directory of accounts for one role. Admins are never listed. |

Health (no auth): `GET /healthz` (liveness), `GET /readyz` (200 when MongoDB is connected, otherwise 503).

## data-service (port 4100)

Mounted at `/api/data` unless noted. All routes below require a bearer token, except the health check and the internal route.

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Returns `{ status: "ok" }`. No auth. |

### Modules (any signed-in user)

| Method | Path | Purpose |
|---|---|---|
| GET | `/modules` | All modules, with `code`, `presentation` and `lengthDays`. |
| GET | `/modules/:code` | Presentations (cohorts) of one module. 404 if the module does not exist. |

### Module enrollments and student detail (instructors and admins)

Instructors can only access modules assigned to them. Admins can access any module. A request for a module the instructor is not assigned to returns 403 `Module not assigned to this instructor`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/modules/:code/:presentation/enrollments` | Enrollments in one presentation, with final results. |
| GET | `/students/:externalId/modules/:code/:presentation` | One student's detail for one presentation (assessments, activity and outcome). 404 `Student not found` if the student does not exist; 404 `Student not enrolled in this module` if they are not enrolled in that presentation. |

### Instructor

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/instructor/me/modules` | Instructor | `{ moduleCodes }` assigned to the current instructor. |

### Student demo-account linking

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/demo-accounts/available` | Student | `{ externalIds }` of demo IDs with no login attached. IDs only. |
| POST | `/demo-accounts/link` | Student | Body `{ externalId }`. Links the current account to a demo student. 201 `{ student }`. |
| GET | `/demo-accounts/me` | Student | The linked demo student. 404 `No demo account linked` if none. |
| GET | `/demo-accounts/me/modules` | Student | `{ modules }`: the modules the linked student is enrolled in. Returns `[]` if no enrollments. 404 if no link. |
| GET | `/demo-accounts/me/prediction-features` | Student | Aggregated prediction features for the linked student (assessment score, engagement, completion). 404 if no enrollment data. |

### Admin: linked accounts, audit log, instructors and assignments

| Method | Path | Purpose |
|---|---|---|
| GET | `/demo-accounts/linked` | `{ students }`: linked demo students with the linked user's name (or "Name unavailable"). |
| DELETE | `/demo-accounts/:externalId/link` | Unlink a demo student from its login. 204. 404 if not linked. Writes an audit entry. |
| GET | `/admin/audit-log` | `{ entries }`: the 100 most recent audit entries, newest first. |
| GET | `/admin/instructors` | `{ instructors }`: instructor accounts (from auth-service) for the assignment picker. |
| POST | `/admin/module-assignments` | Body `{ instructorId, moduleCode }`. Assigns a module to an instructor (idempotent). 404 if the module does not exist; 400 if the target is not an instructor. Returns 201. |
| GET | `/admin/instructors/:instructorId/modules` | `{ moduleCodes }` assigned to one instructor. |
| DELETE | `/admin/module-assignments/:instructorId/:moduleCode` | Remove one assignment. 204. 404 if none exists. |

### Internal (service-to-service)

Mounted before the user-token middleware. Requires `X-Service-Auth`.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/data/internal/role-changes` | Called by auth-service after an admin changes a role. Body (strict): `{ actorUid, actorName, targetUid, targetName, previousRole, newRole }`, where roles are `student` or `instructor`. Writes a `user.role_change` audit entry. If `newRole` is not `instructor`, removes the target's module assignments. Returns `{ assignmentsRemoved }`. 401 if the secret is missing or wrong; 400 if the body is invalid. |

## ml-service (port 5000)

Browser requests reach it as `/ml/...`. The Nginx proxy strips the `/ml` prefix. CORS allows `http://localhost:5173`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | `{ status: "ok" }` |
| GET | `/ready` | `{ status: "ready" }` |
| GET | `/model/health` | Model status. `{ loaded, trained, model, trained_at, data_is_synthetic, test_roc_auc }`. If no trained model is loaded, returns the rule-based baseline with `trained: false`. |
| POST | `/predict` | Score one student. Body: `{ student_id?, features: { assessment_score, engagement, completion_rate } }`, each value between 0 and 1. Returns `{ student_id, prediction, risk_score, model, warning }`. `prediction` is `at_risk` when `risk_score` is 0.5 or more, otherwise `lower_risk`. Responses always include a warning that the trained model is not an early-warning system and has not been externally validated. |

The trained `risk-v2` model uses only `assessment_score` and `engagement`. The request schema still requires `completion_rate`; the rule-based baseline uses it. See the open item in the project notes.
