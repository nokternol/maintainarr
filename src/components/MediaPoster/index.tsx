import { cn } from '@app/lib/utils/cn';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './MediaPoster.module.css';

type LoadState = 'idle' | 'loading' | 'loaded';

// Matches the VirtualMediaGrid / MediaGrid responsive column breakpoints.
const POSTER_SIZES = [
  '(min-width: 1536px) 12.5vw',
  '(min-width: 1280px) 16.67vw',
  '(min-width: 1024px) 20vw',
  '(min-width: 768px) 25vw',
  '(min-width: 640px) 33.33vw',
  '50vw',
].join(', ');

// Items that remain in the viewport for less than this duration never issue
// any image requests. 75 ms sits in the middle of the 50–100 ms target range.
const DWELL_MS = 75;

// Tracks w92 thumbnail URLs whose images have already completed loading in this
// session. Re-mounts (scrolling back to a previously seen item) skip the dwell
// delay because the browser serves the image from its HTTP cache instantly.
// Exported (underscore-prefixed) exclusively for test isolation.
export const _thumbCache = new Set<string>();

// Swap the original image size segment for w92 to get a tiny TMDB thumbnail.
// Covers /t/p/original/, /t/p/w500/, /t/p/w780/, etc.
function toTmdbThumbnail(src: string): string {
  return src.replace(/\/t\/p\/[^/]+\//, '/t/p/w92/');
}

export interface MediaPosterProps {
  src?: string;
  alt: string;
  fallbackText?: string;
  aspectRatio?: 'poster' | 'banner' | 'square';
  className?: string;
}

export const MediaPoster = ({
  src,
  alt,
  fallbackText,
  aspectRatio = 'poster',
  className = '',
}: MediaPosterProps) => {
  const [hasError, setHasError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // thumbSrc is null when src is absent (fallback path).
  const thumbSrc = src ? toTmdbThumbnail(src) : null;

  // Three-state machine:
  //   'idle'    — no images in DOM; dwell timer not yet fired (or reset after abort)
  //   'loading' — images are in DOM; request is in-flight
  //   'loaded'  — poster onLoad fired; images stay permanently for this mount
  //
  // Starting in 'loading' when the thumbnail is already cached skips the dwell
  // delay on re-mounts (browser serves the image instantly from HTTP cache).
  const [loadState, setLoadState] = useState<LoadState>(() =>
    thumbSrc && _thumbCache.has(thumbSrc) ? 'loading' : 'idle'
  );

  // Mirror ref so the IntersectionObserver callback can read current state
  // without capturing a stale closure.
  const loadStateRef = useRef<LoadState>(loadState);

  // Stored so the onLoad handler can disconnect the observer eagerly —
  // once the poster is painted there is nothing left to abort.
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Keeps useState and the ref mirror in sync atomically. Any path that
  // calls one must call both — this helper makes omission impossible.
  // Defined at component scope so the JSX onLoad handler can also use it.
  const transition = useCallback((next: LoadState) => {
    setLoadState(next);
    loadStateRef.current = next;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !src) return;

    const thumb = toTmdbThumbnail(src);
    const cached = _thumbCache.has(thumb);

    // Reset on src change. Cache hits start in 'loading' (skip dwell).
    transition(cached ? 'loading' : 'idle');

    let timerId: ReturnType<typeof setTimeout> | null = null;

    function startDwellTimer() {
      timerId = setTimeout(() => {
        transition('loading');
        timerId = null;
      }, DWELL_MS);
    }

    // ── Primary mechanism: dwell timer ────────────────────────────────────
    // Only started for non-cached items. If the component unmounts before
    // DWELL_MS elapses, the cleanup cancels the timer and no request fires.
    if (!cached) startDwellTimer();

    // ── IntersectionObserver ───────────────────────────────────────────────
    // Dual purpose:
    //   1. Cancel the dwell timer for overscan rows that are in the DOM but
    //      outside the visible viewport (existing behaviour).
    //   2. Abort an in-flight request ('loading' state) when the user scrolls
    //      away by transitioning back to 'idle' (unmounts the <Image>).
    //
    // loadStateRef avoids stale-closure issues inside the callback.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Restart dwell timer only when idle and no timer is running.
          if (timerId === null && loadStateRef.current === 'idle') startDwellTimer();
        } else {
          // Cancel pending timer (idle path).
          if (timerId !== null) {
            clearTimeout(timerId);
            timerId = null;
          }
          // Abort in-flight request (loading path).
          if (loadStateRef.current === 'loading') transition('idle');
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current = observer;
    observer.observe(el);

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      observer.disconnect();
      observerRef.current = null;
    };
  }, [src, transition]);

  const aspectClasses = {
    poster: styles.aspectPoster,
    banner: styles.aspectBanner,
    square: styles.aspectSquare,
  };

  const containerClassName = cn(styles.container, aspectClasses[aspectRatio], className);

  if (!src || hasError) {
    return <div className={cn(containerClassName, styles.fallback)}>{fallbackText || alt}</div>;
  }

  return (
    <div ref={containerRef} className={containerClassName}>
      {/* Tiny TMDB thumbnail blurred as a poster-specific loading placeholder.
          Only rendered once the dwell period elapses (or immediately on cache
          hit). Unmounts if the IO aborts the request ('idle' state). */}
      {loadState !== 'idle' && thumbSrc && (
        <img
          src={thumbSrc}
          aria-hidden="true"
          alt=""
          className={styles.thumbBlur}
          onLoad={() => _thumbCache.add(thumbSrc)}
        />
      )}
      {loadState !== 'idle' && (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={POSTER_SIZES}
          onLoad={() => {
            transition('loaded');
            observerRef.current?.disconnect();
            observerRef.current = null;
          }}
          onError={() => setHasError(true)}
          style={{ objectFit: 'cover', zIndex: 1 }}
        />
      )}
    </div>
  );
};

export default MediaPoster;
