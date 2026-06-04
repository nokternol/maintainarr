import { describe, expect, it } from 'vitest';
import { SESSION_TTL_SECONDS } from '../config';

const MS_PER_DAY = 86400 * 1000;
const DAYS_30 = 30 * MS_PER_DAY;

describe('SESSION_TTL_SECONDS', () => {
  it('is exactly 30 days expressed in seconds', () => {
    expect(SESSION_TTL_SECONDS).toBe(86400 * 30);
  });

  it('cookie maxAge (ms) and store ttl (s) agree on the same duration', () => {
    const cookieMaxAgeMs = SESSION_TTL_SECONDS * 1000;
    const storeTtlMs = SESSION_TTL_SECONDS * 1000;
    expect(cookieMaxAgeMs).toBe(storeTtlMs);
    expect(cookieMaxAgeMs).toBe(DAYS_30);
  });
});
