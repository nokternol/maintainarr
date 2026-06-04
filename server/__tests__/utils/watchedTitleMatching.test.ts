/**
 * watchedTitleMatching — pure unit tests for normalized title matching.
 *
 * Run: vitest run --project server
 */
import {
  buildWatchedTitleSet,
  isTitleWatched,
  normalizeTitle,
} from '@server/utils/watchedTitleMatching';
import { describe, expect, it } from 'vitest';

// ─── normalizeTitle ───────────────────────────────────────────────────────────

describe('normalizeTitle', () => {
  it('strips leading article "The"', () => {
    expect(normalizeTitle('The Matrix')).toBe('matrix');
  });

  it('strips leading article "A"', () => {
    expect(normalizeTitle('A Beautiful Mind')).toBe('beautiful mind');
  });

  it('strips leading article "An"', () => {
    expect(normalizeTitle('An American Werewolf in London')).toBe('american werewolf in london');
  });

  it('leaves non-article-prefixed titles unchanged', () => {
    expect(normalizeTitle('Batman Begins')).toBe('batman begins');
  });

  it('strips trailing year suffix "(YYYY)"', () => {
    expect(normalizeTitle('The Dark Knight (2008)')).toBe('dark knight');
  });

  it('strips both article and year suffix', () => {
    expect(normalizeTitle('The Matrix (1999)')).toBe('matrix');
  });

  it('preserves colons and internal punctuation', () => {
    expect(normalizeTitle('Star Wars: Episode IV (1977)')).toBe('star wars: episode iv');
  });

  it('normalizes extra whitespace', () => {
    expect(normalizeTitle('  The   Matrix  ')).toBe('matrix');
  });

  it('handles already-lowercase input', () => {
    expect(normalizeTitle('the matrix')).toBe('matrix');
  });
});

// ─── buildWatchedTitleSet ─────────────────────────────────────────────────────

describe('buildWatchedTitleSet', () => {
  it('returns a Set of normalized titles', () => {
    const set = buildWatchedTitleSet(['The Matrix', 'Batman Begins (2005)', 'breaking bad']);
    expect(set.has('matrix')).toBe(true);
    expect(set.has('batman begins')).toBe(true);
    expect(set.has('breaking bad')).toBe(true);
  });

  it('returns empty set for empty input', () => {
    expect(buildWatchedTitleSet([]).size).toBe(0);
  });
});

// ─── isTitleWatched ───────────────────────────────────────────────────────────

describe('isTitleWatched', () => {
  it('matches when Tautulli title and media title normalize to the same value', () => {
    const set = buildWatchedTitleSet(['The Matrix']);
    expect(isTitleWatched('The Matrix', set)).toBe(true);
  });

  it('matches when Tautulli has year suffix but media item does not', () => {
    const set = buildWatchedTitleSet(['Batman Begins (2005)']);
    expect(isTitleWatched('Batman Begins', set)).toBe(true);
  });

  it('matches case-insensitively when Tautulli title is lowercase', () => {
    const set = buildWatchedTitleSet(['breaking bad']);
    expect(isTitleWatched('Breaking Bad', set)).toBe(true);
  });

  it('returns false when title is not in the watched set', () => {
    const set = buildWatchedTitleSet(['Breaking Bad']);
    expect(isTitleWatched('Succession', set)).toBe(false);
  });

  it('matches "The Boys" via article stripping', () => {
    const set = buildWatchedTitleSet(['The Boys']);
    expect(isTitleWatched('The Boys', set)).toBe(true);
  });
});
