import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authenticateToken } from './middleware/auth.js';
import { errorHandler } from './utils/AppError.js';
import dataRoutes from './routes/data.routes.js';
import instructorRoutes from './routes/instructors.routes.js';
import internalRoutes from './routes/internal.routes.js';
import studentModulesRoutes from './routes/studentModules.routes.js';

const app = express();

// Security & parsing
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Service-to-service routes (shared-secret auth). Must be mounted before the user-token middleware.
app.use('/api/data/internal', internalRoutes);

// Require auth for all data routes
app.use('/api/data', authenticateToken);

// Routes
app.use('/api/data', dataRoutes);
app.use('/api/data', instructorRoutes);
app.use('/api/data', studentModulesRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;