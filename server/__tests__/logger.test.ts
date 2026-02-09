import { describe, expect, it } from 'vitest';
import logger, { getChildLogger } from '../logger';

describe('logger', () => {
  it('exports a default logger instance', () => {
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  it('logs without throwing', () => {
    expect(() => logger.info('test message')).not.toThrow();
    expect(() => logger.error('test error')).not.toThrow();
    expect(() => logger.warn('test warning')).not.toThrow();
  });
});

describe('getChildLogger', () => {
  it('returns a logger instance', () => {
    const child = getChildLogger('TestModule');
    expect(child).toBeDefined();
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
    expect(typeof child.warn).toBe('function');
    expect(typeof child.debug).toBe('function');
  });

  it('logs with label metadata without throwing', () => {
    const child = getChildLogger('TestModule');
    expect(() => child.info('child log message')).not.toThrow();
    expect(() => child.info('with context', { requestId: 'test-123' })).not.toThrow();
  });

  it('creates distinct child loggers for different labels', () => {
    const api = getChildLogger('API');
    const db = getChildLogger('Database');
    expect(api).not.toBe(db);
  });
});
