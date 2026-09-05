import http from 'node:http';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { logger } from './utils/logger.js';

const app = createApp();

if (!process.env.VERCEL) {
  const server = http.createServer(app);
  initSockets(server);
  server.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

export default app;
