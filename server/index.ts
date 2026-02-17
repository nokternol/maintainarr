import 'reflect-metadata';
import { loadEnv } from './env';
// Must run before any import that reads process.env (including loadConfig).
loadEnv();
import { TypeormStore } from 'connect-typeorm';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import session from 'express-session';
import helmet from 'helmet';
import next from 'next';
import { loadConfig } from './config';
import { buildContainer, scopePerRequest } from './container';
import { initializeDatabase } from './database';
import { Session } from './database/entities/Session';
import { getChildLogger } from './logger';
import { errorHandlerMiddleware, requestIdMiddleware, requestLoggerMiddleware } from './middleware';
import { createApiRouter } from './modules';

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

    // Initialize database connection
    const dataSource = await initializeDatabase(config);

    // Build DI container with initialized dependencies
    const container = buildContainer({
      config,
      dataSource,
    });

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
    server.use(cookieParser());

    // Session middleware (before API routes)
    const sessionRepo = dataSource.getRepository(Session);
    server.use(
      '/api',
      session({
        secret: config.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: {
          maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
          httpOnly: true,
          sameSite: 'lax',
          secure: config.NODE_ENV === 'production',
        },
        store: new TypeormStore({
          cleanupLimit: 2,
          ttl: 86400 * 30, // 30 days in seconds
        }).connect(sessionRepo),
      })
    );

    // Request pipeline
    server.use(requestIdMiddleware);
    server.use(requestLoggerMiddleware);
    server.use(scopePerRequest);

    // API routes — dependencies injected via container cradle
    server.use('/api', createApiRouter(container.cradle));

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

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      log.info(`${signal} received, closing server gracefully`);
      httpServer.close(async () => {
        log.info('HTTP server closed');
        await dataSource.destroy();
        log.info('Database connection closed');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    log.error('Failed to start server', { error });
    process.exit(1);
  }
}

startServer();
