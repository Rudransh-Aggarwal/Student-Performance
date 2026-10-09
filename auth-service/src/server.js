import mongoose from 'mongoose';
import { createApp } from './app.js';
import { env } from './config/env.js';

await mongoose.connect(env.MONGO_URI);

const server = createApp().listen(env.PORT, () => {
  console.log(`auth-service listening on :${env.PORT} (${env.NODE_ENV})`);
});

const shutdown = (signal) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => void mongoose.disconnect().finally(() => process.exit(0)));
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
