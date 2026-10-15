import mongoose from 'mongoose';
import app from './app.js';
import { env } from './config/env.js';

async function start() {
  try {
    // Connect to MongoDB
    await mongoose.connect(env.MONGO_URI);
    console.log('✓ MongoDB connected');

    // Start server
    app.listen(env.PORT, () => {
      console.log(`✓ Data service running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('✗ Startup error:', err.message);
    process.exit(1);
  }
}

start();