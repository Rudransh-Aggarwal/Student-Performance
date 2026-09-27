import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import { firebaseAuth } from './config/firebase.js';
import { createAuth } from './middleware/auth.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { mongoUsers } from './repos/users.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { notifyRoleChange } from './services/roleChangeNotifier.js';

export function createApp({
  verifyIdToken = (token) => firebaseAuth.verifyIdToken(token),
  users = mongoUsers,
  isReady = () => mongoose.connection.readyState === 1,
  notifyRoleChange: notify = notifyRoleChange,
} = {}) {
  const app = express();
  const auth = createAuth({ verifyIdToken, users });

  app.set('trust proxy', 1); // behind a Kubernetes ingress
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL }));
  app.use(express.json({ limit: '10kb' }));

  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.get('/readyz', (_req, res) => {
    const ready = isReady();
    res.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
  });

  app.use('/api/auth', createAuthRouter({ auth, users, notifyRoleChange: notify }));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}