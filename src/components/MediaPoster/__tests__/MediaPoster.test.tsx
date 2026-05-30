import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen } from '@tests/helpers/component';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MediaPoster, _thumbCache } from '../index';

// ── IO test helpers ────────────────────────────────────────────────────────────
// Creates a controllable IntersectionObserver mock. Returns a `fireIO` helper
// that synchronously invokes the last-registered IO callback, and a `disconnect`
// spy to verify observer teardown.
function makeIOControl() {
  let lastCallback: IntersectionObserverCallback | null = null;
  const disconnectSpy = vi.fn();

  class MockIO {
    constructor(cb: IntersectionObserverCallback) {
      lastCallback = cb;
    }
    observe() {}
    disconnect() {
      disconnectSpy();
    }
    unobserve() {}
  }

  vi.stubGlobal('IntersectionObserver', MockIO);

  function fireIO(isIntersecting: boolean) {
    act(() => {
      lastCallback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
    });
  }

  return { fireIO, disconnectSpy };
}

// Advance past the dwell period so image elements render
function passDwell() {
  act(() => vi.advanceTimersByTime(100));
}

describe('MediaPoster', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _thumbCache.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    _thumbCache.clear();
  });

  it('renders an image with correct src and alt', () => {
    const src = 'https://example.com/poster.jpg';
    const alt = 'Movie Poster';
    render(<MediaPoster src={src} alt={alt} />);
    passDwell();
    const img = screen.getByRole('img', { name: alt });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', src);
  });

  it('renders fallback UI when src is missing', () => {
    const fallbackText = 'No Poster';
    render(<MediaPoster alt="Movie Poster" fallbackText={fallbackText} />);
    // Fallback renders immediately — no dwell needed, no src to load
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(fallbackText)).toBeInTheDocument();
  });

  it('renders fallback UI when the img fires an onError event (broken link)', () => {
    const fallbackText = 'Broken Image';
    render(
      <MediaPoster
        src="https://example.com/broken.jpg"
        alt="Movie Poster"
        fallbackText={fallbackText}
      />
    );
    passDwell();
    const img = screen.getByRole('img');
    fireEvent.error(img);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(fallbackText)).toBeInTheDocument();
  });

  it('does not render a skeleton overlay — blur placeholder is handled by next/image', () => {
    render(<MediaPoster src="https://example.com/poster.jpg" alt="Poster" />);
    passDwell();
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('renders image with fill layout via next/image', () => {
    render(<MediaPoster src="https://example.com/poster.jpg" alt="Poster" />);
    passDwell();
    const img = screen.getByRole('img', { name: 'Poster' });
    expect(img).toHaveStyle({ position: 'absolute' });
  });

  it('renders a per-poster thumbnail as the loading placeholder', () => {
    const src = 'https://image.tmdb.org/t/p/original/abc123.jpg';
    const { container } = render(<MediaPoster src={src} alt="Poster" />);
    passDwell();
    const thumb = container.querySelector('img[aria-hidden]');
    expect(thumb).toBeInTheDocument();
    expect(thumb).toHaveAttribute('src', 'https://image.tmdb.org/t/p/w92/abc123.jpg');
    // The main next/image does not use the static blur placeholder
    const main = screen.getByRole('img', { name: 'Poster' });
    expect(main).not.toHaveAttribute('data-placeholder', 'blur');
  });

  // ── Dwell-timer lifecycle tests ────────────────────────────────────────────

  it('does not render any img elements before the dwell period elapses', () => {
    const { container } = render(
      <MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />
    );
    // No timer advancement — neither the thumbnail nor the main image should exist
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('renders both thumbnail and main image after the dwell period elapses', () => {
    const { container } = render(
      <MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />
    );
    passDwell();
    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();
    expect(container.querySelector('img[aria-hidden]')).toBeInTheDocument();
  });

  it('does not cause state updates when unmounted before dwell elapses', () => {
    const { unmount } = render(
      <MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />
    );
    // Unmount clears the timer — advancing past dwell must not throw or warn
    unmount();
    act(() => vi.advanceTimersByTime(200));
  });

  it('renders immediately when the thumbnail URL is already in the cache', () => {
    const src = 'https://image.tmdb.org/t/p/original/cached.jpg';
    // Pre-populate cache as if a previous mount already loaded this thumbnail
    _thumbCache.add('https://image.tmdb.org/t/p/w92/cached.jpg');
    render(<MediaPoster src={src} alt="Poster" />);
    // No timer advancement required — should render immediately from cache
    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();
  });

  it('adds the thumbnail URL to the cache when it loads', () => {
    const src = 'https://image.tmdb.org/t/p/original/abc123.jpg';
    const thumbSrc = 'https://image.tmdb.org/t/p/w92/abc123.jpg';
    const { container } = render(<MediaPoster src={src} alt="Poster" />);
    passDwell();
    const thumb = container.querySelector('img[aria-hidden]') as HTMLImageElement;
    expect(_thumbCache.has(thumbSrc)).toBe(false);
    fireEvent.load(thumb);
    expect(_thumbCache.has(thumbSrc)).toBe(true);
  });
});

// ── Abort mechanism ────────────────────────────────────────────────────────────

describe('MediaPoster — IO abort mechanism', () => {
  let fireIO: (isIntersecting: boolean) => void;

  beforeEach(() => {
    vi.useFakeTimers();
    _thumbCache.clear();
    ({ fireIO } = makeIOControl());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    _thumbCache.clear();
  });

  // A01 — abort after dwell fires, before poster loads
  it('removes both images when IO fires out-of-viewport after dwell (abort in-flight request)', () => {
    const { container } = render(
      <MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />
    );
    passDwell();
    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();

    fireIO(false);

    expect(screen.queryByRole('img', { name: 'Poster' })).not.toBeInTheDocument();
    expect(container.querySelector('img[aria-hidden]')).not.toBeInTheDocument();
  });

  // A03 — after abort, re-entry requires full 75ms dwell before images re-render
  it('requires full 75ms re-dwell after an abort before images re-appear', () => {
    render(<MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />);
    passDwell();
    fireIO(false); // abort

    fireIO(true); // re-entry

    act(() => vi.advanceTimersByTime(74));
    expect(screen.queryByRole('img', { name: 'Poster' })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();
  });

  // A04 — cache-hit path must still create the observer (no early return bypasses IO)
  it('aborts images even when thumb was already cached (observer created on cache-hit path)', () => {
    const src = 'https://image.tmdb.org/t/p/original/cached.jpg';
    _thumbCache.add('https://image.tmdb.org/t/p/w92/cached.jpg');

    const { container } = render(<MediaPoster src={src} alt="Poster" />);
    // No dwell needed — cache hit renders immediately
    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();

    fireIO(false);

    expect(screen.queryByRole('img', { name: 'Poster' })).not.toBeInTheDocument();
    expect(container.querySelector('img[aria-hidden]')).not.toBeInTheDocument();
  });
});

// ── Load lock + observer teardown ──────────────────────────────────────────────

describe('MediaPoster — load lock and observer teardown', () => {
  let fireIO: (isIntersecting: boolean) => void;
  let disconnectSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    _thumbCache.clear();
    ({ fireIO, disconnectSpy } = makeIOControl());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    _thumbCache.clear();
  });

  // A02 — once onLoad fires, IO out-of-viewport must not remove the poster
  it('keeps images in DOM when IO fires out-of-viewport after poster has loaded (load lock)', () => {
    render(<MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />);
    passDwell();
    const poster = screen.getByRole('img', { name: 'Poster' });

    fireEvent.load(poster);
    fireIO(false);

    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();
  });

  // A06 — observer must be disconnected when poster onLoad fires
  it('disconnects the IntersectionObserver when the poster finishes loading', () => {
    render(<MediaPoster src="https://image.tmdb.org/t/p/original/abc123.jpg" alt="Poster" />);
    passDwell();
    const poster = screen.getByRole('img', { name: 'Poster' });

    expect(disconnectSpy).not.toHaveBeenCalled();
    fireEvent.load(poster);
    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });
});
