import { describe, expect, it } from 'vitest';
/**
 * Factory helpers — createRadarrMovie and createSonarrSeries.
 * Verifies factories return valid typed objects and accept partial overrides.
 */
import { createRadarrMovie, createSonarrSeries } from '../../tests/factories';

describe('createRadarrMovie', () => {
  it('returns a RadarrMovie with sensible defaults', () => {
    const movie = createRadarrMovie();
    expect(movie.id).toBeTypeOf('number');
    expect(movie.title).toBeTypeOf('string');
    expect(movie.hasFile).toBeTypeOf('boolean');
    expect(movie.monitored).toBeTypeOf('boolean');
    expect(Array.isArray(movie.tags)).toBe(true);
  });

  it('merges overrides into the default', () => {
    const movie = createRadarrMovie({ id: 99, title: 'Blade Runner', year: 1982, hasFile: false });
    expect(movie.id).toBe(99);
    expect(movie.title).toBe('Blade Runner');
    expect(movie.year).toBe(1982);
    expect(movie.hasFile).toBe(false);
  });
});

describe('createSonarrSeries', () => {
  it('returns a SonarrSeries with sensible defaults', () => {
    const series = createSonarrSeries();
    expect(series.id).toBeTypeOf('number');
    expect(series.title).toBeTypeOf('string');
    expect(series.status).toBeTypeOf('string');
    expect(series.monitored).toBeTypeOf('boolean');
    expect(Array.isArray(series.seasons)).toBe(true);
  });

  it('merges overrides into the default', () => {
    const series = createSonarrSeries({ id: 77, title: 'The Wire', year: 2002, status: 'ended' });
    expect(series.id).toBe(77);
    expect(series.title).toBe('The Wire');
    expect(series.year).toBe(2002);
    expect(series.status).toBe('ended');
  });
});
