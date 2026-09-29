import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

// Verifying ID tokens needs only the project id (it uses Google's public keys).
const credential =
  env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
    ? cert({
        projectId: env.FIREBASE_PROJECT_ID,
        clientEmail: env.FIREBASE_CLIENT_EMAIL,
        privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      })
    : undefined;

const app = getApps()[0] ?? initializeApp({ projectId: env.FIREBASE_PROJECT_ID, ...(credential && { credential }) });

export const firebaseAuth = getAuth(app);
