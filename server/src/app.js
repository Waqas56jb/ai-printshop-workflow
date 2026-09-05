import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import customersRoutes from './modules/customers/customers.routes.js';
import stagesRoutes from './modules/stages/stages.routes.js';
import jobsRoutes from './modules/jobs/jobs.routes.js';
import artworkRoutes from './modules/artwork/artwork.routes.js';
import notesRoutes from './modules/notes/notes.routes.js';
import boardRoutes from './modules/board/board.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import voiceRoutes from './modules/voice/voice.routes.js';
import omiRoutes from './modules/omi/omi.routes.js';
import settingsRoutes from './modules/settings/settings.routes.js';
import realtimeRoutes from './modules/realtime/realtime.routes.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, callback) {
        if (
          !origin ||
          env.clientOrigins.includes(origin) ||
          /\.vercel\.app$/.test(origin)
        ) {
          callback(null, true);
          return;
        }
        callback(new Error(`Origin not allowed: ${origin}`));
      },
      credentials: true,
    })
  );
  app.use(morgan('dev'));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/users', usersRoutes);
  app.use('/api/customers', customersRoutes);
  app.use('/api/stages', stagesRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/artworks', artworkRoutes);
  app.use('/api/notes', notesRoutes);
  app.use('/api/board', boardRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/voice', voiceRoutes);
  app.use('/api/omi', omiRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/realtime', realtimeRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
