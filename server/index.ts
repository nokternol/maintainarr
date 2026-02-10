import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import next from 'next';
import { loadConfig } from './config';
import { getChildLogger } from './logger';
import { errorHandlerMiddleware, requestIdMiddleware, requestLoggerMiddleware } from './middleware';

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

    // Trust proxy (for correct IP behind reverse proxy)
    if (config.TRUST_PROXY) {
      server.set('trust proxy', 1);
    }

    // Security
    server.use(helmet({ contentSecurityPolicy: false }));
    server.use(cors());

    // Body parsing
    server.use(express.json());
    server.use(express.urlencoded({ extended: true }));

    // Request pipeline
    server.use(requestIdMiddleware);
    server.use(requestLoggerMiddleware);

    // API routes (will be replaced by apiRouter in Step 5)
    server.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: config.COMMIT_TAG,
      });
    });

    // Next.js catch-all
    server.all('*', (req, res) => handle(req, res));

    // Error handler (must be LAST)
    server.use(errorHandlerMiddleware);

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
