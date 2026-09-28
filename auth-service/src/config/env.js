import 'dotenv/config';
import { z } from 'zod';

const optional = z.string().trim().optional().transform((value) => value || undefined);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1),
  CLIENT_URL: z.string().url(),
  FIREBASE_PROJECT_ID: z.string().min(1),
  AUTH_SERVICE_SECRET: z.string().min(1).default('development-service-secret'),
  // data-service base URL: receives role-change records and clears module assignments on demotion.
  DATA_SERVICE_URL: z.string().url().default('http://localhost:4100'),
  // Only the admin scripts need a service account (or GOOGLE_APPLICATION_CREDENTIALS); the server does not.
  FIREBASE_CLIENT_EMAIL: optional,
  FIREBASE_PRIVATE_KEY: optional,
});

export const env = envSchema.parse(process.env);