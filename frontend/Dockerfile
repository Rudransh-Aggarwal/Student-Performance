# Build stage: Vite bakes VITE_* values into the bundle at build time.
FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_FIREBASE_API_KEY
ARG VITE_FIREBASE_AUTH_DOMAIN
ARG VITE_FIREBASE_PROJECT_ID
ARG VITE_FIREBASE_APP_ID
ARG VITE_AUTH_PROVIDERS=google,github
ARG VITE_DATA_SERVICE_URL=http://localhost:4100
ARG VITE_ML_SERVICE_URL=http://localhost:5000
ENV VITE_FIREBASE_API_KEY=$VITE_FIREBASE_API_KEY \
    VITE_FIREBASE_AUTH_DOMAIN=$VITE_FIREBASE_AUTH_DOMAIN \
    VITE_FIREBASE_PROJECT_ID=$VITE_FIREBASE_PROJECT_ID \
    VITE_FIREBASE_APP_ID=$VITE_FIREBASE_APP_ID \
    VITE_AUTH_PROVIDERS=$VITE_AUTH_PROVIDERS \
    VITE_DATA_SERVICE_URL=$VITE_DATA_SERVICE_URL \
    VITE_ML_SERVICE_URL=$VITE_ML_SERVICE_URL

COPY package*.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# Runtime stage: static files behind Nginx.
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ || exit 1