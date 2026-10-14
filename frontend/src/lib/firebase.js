import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const env = import.meta.env;

if (!env.VITE_FIREBASE_API_KEY) {
  throw new Error('Firebase is not configured. Copy frontend/.env.example to frontend/.env and fill it in.');
}

export const auth = getAuth(
  initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  }),
);

export const socialProviders = (env.VITE_AUTH_PROVIDERS ?? 'google,github')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);
