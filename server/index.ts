import express from 'express';
import next from 'next';
import logger from './logger';

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5056;

const app = next({ dev });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    logger.info('Preparing Next.js...');
    await app.prepare();
    logger.info('Next.js prepared successfully');

    const server = express();

    server.use(express.json());
    server.use(express.urlencoded({ extended: true }));

    server.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: process.env.COMMIT_TAG || 'local',
      });
    });

    server.all('*', (req, res) => handle(req, res));

    const httpServer = server.listen(port, '0.0.0.0', () => {
      logger.info(`Server started on port ${port}`);
      logger.info(`Environment: ${dev ? 'development' : 'production'}`);
      logger.info(`Open http://localhost:${port}`);
    });

    httpServer.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${port} is already in use`);
      } else {
        logger.error('Server error:', error);
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
