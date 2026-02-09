import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadConfig, getConfig, _resetConfig } from '../config';

describe('config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    _resetConfig();
    // Clear relevant env vars so defaults apply
    for (const key of [
      'NODE_ENV',
      'PORT',
      'COMMIT_TAG',
      'LOG_LEVEL',
      'LOG_DIR',
      'DB_PATH',
      'TRUST_PROXY',
    ]) {
      delete process.env[key];
    }
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    _resetConfig();
  });

  describe('loadConfig', () => {
    it('loads with defaults when no env vars are set', () => {
      const config = loadConfig();
      expect(config.NODE_ENV).toBe('development');
      expect(config.PORT).toBe(5057);
      expect(config.COMMIT_TAG).toBe('local');
      expect(config.LOG_LEVEL).toBe('info');
      expect(config.LOG_DIR).toBe('./config/logs');
      expect(config.DB_PATH).toBe('./config/db/maintainarr.db');
      expect(config.TRUST_PROXY).toBe(false);
    });

    it('respects env var overrides', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '3000';
      process.env.LOG_LEVEL = 'debug';
      process.env.TRUST_PROXY = 'true';

      const config = loadConfig();
      expect(config.NODE_ENV).toBe('production');
      expect(config.PORT).toBe(3000);
      expect(config.LOG_LEVEL).toBe('debug');
      expect(config.TRUST_PROXY).toBe(true);
    });

    it('coerces PORT from string to number', () => {
      process.env.PORT = '8080';
      const config = loadConfig();
      expect(config.PORT).toBe(8080);
      expect(typeof config.PORT).toBe('number');
    });

    it('rejects invalid PORT', () => {
      process.env.PORT = 'not-a-number';
      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('rejects PORT out of range', () => {
      process.env.PORT = '99999';
      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('rejects invalid NODE_ENV', () => {
      process.env.NODE_ENV = 'staging';
      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('rejects invalid LOG_LEVEL', () => {
      process.env.LOG_LEVEL = 'trace';
      expect(() => loadConfig()).toThrow('Invalid configuration');
    });

    it('handles TRUST_PROXY false string', () => {
      process.env.TRUST_PROXY = 'false';
      const config = loadConfig();
      expect(config.TRUST_PROXY).toBe(false);
    });

    it('handles TRUST_PROXY with "1"', () => {
      process.env.TRUST_PROXY = '1';
      const config = loadConfig();
      expect(config.TRUST_PROXY).toBe(true);
    });
  });

  describe('getConfig', () => {
    it('throws if loadConfig has not been called', () => {
      expect(() => getConfig()).toThrow('Config not loaded');
    });

    it('returns config after loadConfig has been called', () => {
      loadConfig();
      const config = getConfig();
      expect(config).toBeDefined();
      expect(config.PORT).toBe(5057);
    });
  });
});
