/**
 * resolveApiKey unit tests.
 *
 * Pure function — no DB or config needed.
 * Covers: param > db > env > none priority order.
 *
 * Run: vitest run --project server
 */
import { resolveApiKey } from '@server/utils/keyResolver';
import { describe, expect, it } from 'vitest';

describe('resolveApiKey', () => {
  it('returns explicit key with source "param" when param is provided', () => {
    const result = resolveApiKey('param-key', 'db-key', 'env-key');
    expect(result).toEqual({ key: 'param-key', source: 'param' });
  });

  it('returns db key with source "db" when no explicit key', () => {
    const result = resolveApiKey(undefined, 'db-key', 'env-key');
    expect(result).toEqual({ key: 'db-key', source: 'db' });
  });

  it('returns env key with source "env" when no explicit or db key', () => {
    const result = resolveApiKey(undefined, null, 'env-key');
    expect(result).toEqual({ key: 'env-key', source: 'env' });
  });

  it('returns undefined with source "none" when no keys available', () => {
    const result = resolveApiKey(undefined, null, undefined);
    expect(result).toEqual({ key: undefined, source: 'none' });
  });

  it('prefers explicit param over db key', () => {
    const result = resolveApiKey('explicit', 'from-db', undefined);
    expect(result.source).toBe('param');
    expect(result.key).toBe('explicit');
  });

  it('prefers db key over env key', () => {
    const result = resolveApiKey(undefined, 'from-db', 'from-env');
    expect(result.source).toBe('db');
    expect(result.key).toBe('from-db');
  });

  it('treats empty string explicit key as absent', () => {
    const result = resolveApiKey('', 'db-key', 'env-key');
    expect(result.source).toBe('db');
    expect(result.key).toBe('db-key');
  });

  it('treats empty string db key as absent', () => {
    const result = resolveApiKey(undefined, '', 'env-key');
    expect(result.source).toBe('env');
    expect(result.key).toBe('env-key');
  });
});
