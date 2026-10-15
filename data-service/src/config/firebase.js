import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { env } from './env.js';

try {
  initializeApp({
    projectId: env.FIREBASE_PROJECT_ID,
  });
} catch (err) {
  if (!err.message.includes('already exists')) {
    throw err;
  }
}

export const auth = getAuth();

export async function verifyToken(token) {
  return auth.verifyIdToken(token);
}