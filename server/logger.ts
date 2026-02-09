import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';

const logDir = process.env.LOG_DIR || './config/logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Human-readable format for console and text log files
const humanFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, label, requestId, ...meta }) => {
    const labelTag = label ? `[${label}]` : '';
    const ridTag = requestId ? `[${requestId}]` : '';
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}:${labelTag}${ridTag} ${message}${metaStr}`;
  }),
);

// Uncolorized human format for text log files
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.printf(({ timestamp, level, message, label, requestId, ...meta }) => {
    const labelTag = label ? `[${label}]` : '';
    const ridTag = requestId ? `[${requestId}]` : '';
    const metaStr =
      Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}:${labelTag}${ridTag} ${message}${metaStr}`;
  }),
);

// Machine-readable JSON format for parsing and monitoring tools
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

const logger = winston.createLogger({
  level: LOG_LEVEL,
  defaultMeta: { service: 'maintainarr' },
  transports: [
    // Human-readable daily rotating log
    new DailyRotateFile({
      filename: `${logDir}/maintainarr-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: fileFormat,
    }),
    // Machine-readable JSON log (for parsing/monitoring)
    new DailyRotateFile({
      filename: `${logDir}/maintainarr-%DATE%.json.log`,
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d',
      format: jsonFormat,
    }),
  ],
});

// Console transport in non-production environments
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({ format: humanFormat }));
}

/**
 * Create a child logger with a fixed label for a specific module.
 *
 * Usage:
 *   const log = getChildLogger('API');
 *   log.info('Request received', { requestId: '...' });
 *
 * The label appears in every log entry from this logger,
 * making it easy to filter logs by subsystem.
 */
export function getChildLogger(label: string): winston.Logger {
  return logger.child({ label });
}

export default logger;
