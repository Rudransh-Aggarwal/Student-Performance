# Deployment

Two supported ways to run the system locally: Docker Compose (simplest) and minikube (Kubernetes). Nothing is deployed to a public cluster; the project is a test environment.

## Environment variables

Copy each service's `.env.example` to `.env` and fill it in. Never commit `.env` files, Firebase service account keys or the trained model file.

### auth-service

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `development` | Set to `production` in deployments (development mode returns stack traces). |
| `PORT` | No | `4000` | Listening port. |
| `MONGO_URI` | Yes | none | MongoDB connection string. |
| `CLIENT_URL` | Yes | none | Frontend origin for CORS (for example `http://localhost:5173`). |
| `FIREBASE_PROJECT_ID` | Yes | none | Firebase project for token verification. |
| `AUTH_SERVICE_SECRET` | No | `development-service-secret` | Shared secret with data-service. Must match across services. |
| `DATA_SERVICE_URL` | No | `http://localhost:4100` | Used to record role changes. Set to `http://data-service:4100` in Compose and Kubernetes. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Admin scripts only | none | Path to the service account JSON (for `seed:admin` and `migrate:users`). |
| `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Admin scripts only | none | Alternative to `GOOGLE_APPLICATION_CREDENTIALS`. |

### data-service

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `NODE_ENV` | No | `development` | As above. |
| `PORT` | No | `4100` | Listening port. |
| `MONGO_URI` | Yes | none | MongoDB connection string. |
| `FIREBASE_PROJECT_ID` | Yes | none | Firebase project for token verification. |
| `AUTH_SERVICE_URL` | Yes | none | Base URL of auth-service (for example `http://auth-service:4000`). |
| `AUTH_SERVICE_SECRET` | No | `development-service-secret` | Must match auth-service. |
| `CLIENT_URL` | No | `http://localhost:5173` | Frontend origin for CORS. |

### ml-service

| Variable | Default | Purpose |
|---|---|---|
| `MODEL_DIR` | `ml-service/models` | Folder that holds `risk_model_<version>.joblib` and `model_card.json`. If no model is found, the service uses the rule-based baseline. |

### frontend (build time)

Vite bakes these values into the bundle when the image is built. Changing them requires a rebuild.

| Build argument | Compose value | minikube value | Purpose |
|---|---|---|---|
| `VITE_FIREBASE_API_KEY` | from `.env` | your Web API key | Firebase web config. |
| `VITE_FIREBASE_AUTH_DOMAIN` | from `.env` | `<project-id>.firebaseapp.com` | Firebase web config. |
| `VITE_FIREBASE_PROJECT_ID` | from `.env` | must equal `FIREBASE_PROJECT_ID` | Firebase web config. |
| `VITE_FIREBASE_APP_ID` | from `.env` | your web app ID | Firebase web config. |
| `VITE_AUTH_PROVIDERS` | `google,github` | `google,github` | Sign-in buttons to show. |
| `VITE_DATA_SERVICE_URL` | empty | empty | Empty means same-origin through Nginx. |
| `VITE_ML_SERVICE_URL` | `/ml` | `/ml` | Same-origin path proxied to ml-service. |

The Dockerfile defaults `VITE_DATA_SERVICE_URL` and `VITE_ML_SERVICE_URL` to `localhost` addresses. Always pass the values above explicitly for the containerized frontend.

The Firebase project in the frontend must be the same project as `FIREBASE_PROJECT_ID`. A mismatch causes "Invalid or expired token" errors at sign-in. In Firebase, enable Email/Password, Google and GitHub under Authentication > Sign-in method, and check that the hostname you use (for example `localhost`) is listed under Authorized domains.

## Option 1: Docker Compose

Services: mongo, ml-service, auth-service, data-service and frontend.

1. Stop the local MongoDB Windows service if it is running (port 27017 conflict).
2. Create the root `.env` with `FIREBASE_PROJECT_ID`, `AUTH_SERVICE_SECRET` (optional) and the `VITE_*` values.
3. Generate the model (see the README). Place the files in `ml-service/models/`.
4. Start:
   ```
   docker compose up -d --build
   ```
5. Open http://localhost:5173. Ports: auth-service 4000, data-service 4100, ml-service 5000.
6. Create the first admin with `npm run seed:admin` in `auth-service/` (needs a service account; it can point at the Compose Mongo with `MONGO_URI`).

Rebuild after code, dependency or `VITE_*` changes: `docker compose up -d --build`. Runtime-only `.env` changes: `docker compose up -d`.

## Option 2: minikube (Kubernetes)

Manifests are in `k8s/`:

| File | Contents |
|---|---|
| `00-namespace-config.yaml` | Namespace `student-performance` and the `app-config` ConfigMap (`CLIENT_URL`, `NODE_ENV`, `FIREBASE_PROJECT_ID`, `AUTH_SERVICE_URL`, `MODEL_DIR`). |
| `secret.example.yaml` | Template for `app-secrets` (Mongo credentials, `AUTH_SERVICE_SECRET`). Copy to a git-ignored file before applying. |
| `mongo.yaml` | MongoDB StatefulSet and Service. |
| `mongo-external.yaml` | LoadBalancer Service so MongoDB Compass can connect at localhost:27017 through `minikube tunnel`. |
| `auth-service.yaml`, `data-service.yaml`, `ml-service.yaml`, `frontend.yaml` | Deployments and ClusterIP Services. The ml-service mounts the `ml-models` PVC. |
| `ingress.yaml` | Ingress that routes traffic to the frontend service. The frontend's Nginx forwards `/api/auth`, `/api/data` and `/ml` to the backends. |

### First-time setup

1. Start minikube with the Docker driver: `minikube start --driver=docker`.
2. Apply the namespace, config and secrets:
   ```
   kubectl apply -f k8s/00-namespace-config.yaml
   kubectl apply -f k8s/secret.secret.yaml
   kubectl apply -f k8s/mongo.yaml
   ```
3. Build and load the images (see the next section).
4. Copy the trained model onto the `ml-models` PVC. In the project, a temporary busybox pod mounted the PVC, and `kubectl cp` ran from the `models` folder with relative file names.
5. Apply the remaining manifests. Do not apply `secret.example.yaml`, because it would overwrite the real secrets with placeholders:
   ```
   kubectl apply -f k8s/00-namespace-config.yaml -f k8s/mongo.yaml -f k8s/mongo-external.yaml -f k8s/ml-service.yaml -f k8s/auth-service.yaml -f k8s/data-service.yaml -f k8s/frontend.yaml -f k8s/ingress.yaml
   ```
6. Start the tunnel in an administrator PowerShell: `minikube tunnel`.
7. Open http://localhost:3000. Set `CLIENT_URL` to `http://localhost:3000` in the ConfigMap.
8. Create the first admin with `npm run seed:admin` in `auth-service/`, pointed at the Kubernetes MongoDB (through `mongo-external`) with a service account key.

### Deploying code changes

Images use the tag `:latest` and `imagePullPolicy: IfNotPresent`, so rebuild, load and restart:

```
docker build -t student-performance/auth-service:latest ./auth-service
docker build -t student-performance/data-service:latest ./data-service
docker build -t student-performance/ml-service:latest ./ml-service
docker build -t student-performance/frontend:latest --build-arg VITE_FIREBASE_API_KEY=<key> --build-arg VITE_FIREBASE_AUTH_DOMAIN=<domain> --build-arg VITE_FIREBASE_PROJECT_ID=<project-id> --build-arg VITE_FIREBASE_APP_ID=<app-id> --build-arg VITE_AUTH_PROVIDERS=google,github --build-arg VITE_DATA_SERVICE_URL= --build-arg VITE_ML_SERVICE_URL=/ml ./frontend

minikube image load student-performance/auth-service:latest --overwrite=true
minikube image load student-performance/data-service:latest --overwrite=true
minikube image load student-performance/ml-service:latest --overwrite=true
minikube image load student-performance/frontend:latest --overwrite=true

kubectl apply -f k8s/auth-service.yaml -f k8s/data-service.yaml -f k8s/frontend.yaml
kubectl -n student-performance rollout restart deployment/auth-service
kubectl -n student-performance rollout restart deployment/data-service
kubectl -n student-performance rollout restart deployment/frontend
kubectl -n student-performance rollout status deployment/data-service
```

The commands above apply only the manifests that change between code deployments. Do not apply `secret.example.yaml` here. Rebuild only the images whose code changed. Always run `minikube image load` before restarting; otherwise the pods keep the old image. Confirm a variable with `kubectl -n student-performance exec deploy/auth-service -- printenv DATA_SERVICE_URL`.

### Stopping and resetting

- `minikube stop` keeps the database, the admin account and the Service.
- `minikube delete` removes everything, including the database. The admin account must be created again.
- After `minikube start`, rerun `minikube tunnel` and check the pods with `kubectl -n student-performance get pods`.
- Docker Compose and Kubernetes keep separate databases.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| "Sign-in failed. Please try again." | Firebase rejected the request. Check the browser console for the `auth/...` code. Usually placeholder or mismatched `VITE_*` values, or the provider is not enabled. |
| "Invalid or expired token" on dashboards | Frontend and backend use different Firebase projects. |
| "The role was changed, but module assignments and the audit log could not be updated" | auth-service cannot reach data-service, or `DATA_SERVICE_URL` is wrong. Check the `[role-change]` lines in `kubectl logs deploy/auth-service`. |
| 404 from the internal role-change endpoint | data-service is running an old image. Rebuild and restart it. |
| 401 from the internal role-change endpoint | `AUTH_SERVICE_SECRET` differs between the two services. |
| Dashboard shows no modules for an instructor | No modules are assigned. An admin must assign them. |
| Student sees "No demo account linked" | The student has not linked an ID. |
