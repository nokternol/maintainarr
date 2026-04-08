/**
 * MediaCache unit tests.
 *
 * Run: vitest run --project server
 */
import { MediaCache } from '@server/modules/media/media.cache';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('MediaCache', () => {
  let cache: MediaCache<string[]>;

  beforeEach(() => {
    cache = new MediaCache<string[]>(1000); // 1s TTL for tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns null for a key that has never been set', () => {
    expect(cache.get('movies')).toBeNull();
  });

  it('returns data immediately after set', () => {
    cache.set('movies', ['a', 'b']);
    expect(cache.get('movies')).toEqual(['a', 'b']);
  });

  it('returns data within TTL', () => {
    cache.set('movies', ['a']);
    vi.advanceTimersByTime(999);
    expect(cache.get('movies')).toEqual(['a']);
  });

  it('returns null after TTL expires', () => {
    cache.set('movies', ['a']);
    vi.advanceTimersByTime(1001);
    expect(cache.get('movies')).toBeNull();
  });

  it('invalidate removes the entry before TTL', () => {
    cache.set('movies', ['a']);
    cache.invalidate('movies');
    expect(cache.get('movies')).toBeNull();
  });

  it('invalidate is a no-op for unknown keys', () => {
    expect(() => cache.invalidate('unknown')).not.toThrow();
  });

  it('stores independent entries per key', () => {
    cache.set('movies', ['m1']);
    cache.set('series', ['s1']);
    expect(cache.get('movies')).toEqual(['m1']);
    expect(cache.get('series')).toEqual(['s1']);
  });

  it('invalidating one key does not affect others', () => {
    cache.set('movies', ['m1']);
    cache.set('series', ['s1']);
    cache.invalidate('movies');
    expect(cache.get('movies')).toBeNull();
    expect(cache.get('series')).toEqual(['s1']);
  });
});
