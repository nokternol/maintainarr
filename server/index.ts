import express from 'express';
import next from 'next';
import logger from './logger';

const dev = process.env.NODE_ENV !== 'production';
const port = process.env.PORT ? Number.parseInt(process.env.PORT, 10) : 5056;

const app = next({ dev });
const handle = app.getRequestHandler();

async function startServer() {
  try {
    await app.prepare();

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

    server.listen(port, () => {
      logger.info(`Server started on port ${port}`);
      logger.info(`Environment: ${dev ? 'development' : 'production'}`);
      logger.info(`Open http://localhost:${port}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
