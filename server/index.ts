import express from 'express';
import next from 'next';
import { loadConfig } from './config';
import { getChildLogger } from './logger';

const log = getChildLogger('Server');

async function startServer() {
  const config = loadConfig();
  const dev = config.NODE_ENV !== 'production';
  const port = config.PORT;

  try {
    log.info('Preparing Next.js...');
    const app = next({ dev });
    const handle = app.getRequestHandler();
    await app.prepare();
    log.info('Next.js prepared successfully');

    const server = express();

    server.use(express.json());
    server.use(express.urlencoded({ extended: true }));

    server.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.COMMIT_TAG,
      });
    });

    server.all('*', (req, res) => handle(req, res));

    const httpServer = server.listen(port, '0.0.0.0', () => {
      log.info('Server started', { port, env: config.NODE_ENV });
      log.info(`Open http://localhost:${port}`);
    });

    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        log.error(`Port ${port} is already in use`);
      } else {
        log.error('Server error', { error: error.message });
      }
      process.exit(1);
    });
  } catch (error) {
    log.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
