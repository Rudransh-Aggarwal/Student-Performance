import dotenv from 'dotenv';

dotenv.config();

const requiredVars = [
  'MONGO_URI',
  'FIREBASE_PROJECT_ID',
  'PORT',
  'AUTH_SERVICE_URL',
];

const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  throw new Error(`Missing required env vars: ${missing.join(', ')}`);
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '4100', 10),
  MONGO_URI: process.env.MONGO_URI,
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
  AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
  AUTH_SERVICE_SECRET: process.env.AUTH_SERVICE_SECRET || 'development-service-secret',
};