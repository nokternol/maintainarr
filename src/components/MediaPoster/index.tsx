import { cn } from '@app/lib/utils/cn';
import Image from 'next/image';
import { useState } from 'react';
import styles from './MediaPoster.module.css';

// Matches the VirtualMediaGrid / MediaGrid responsive column breakpoints.
const POSTER_SIZES = [
  '(min-width: 1536px) 12.5vw',
  '(min-width: 1280px) 16.67vw',
  '(min-width: 1024px) 20vw',
  '(min-width: 768px) 25vw',
  '(min-width: 640px) 33.33vw',
  '50vw',
].join(', ');

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
    <div className={containerClassName}>
      {/* Tiny TMDB thumbnail blurred as poster-specific loading placeholder */}
      {/* biome-ignore lint/performance/noImgElement: thumbnail intentionally uses <img> — it is a decorative placeholder, not content */}
      <img
        src={toTmdbThumbnail(src)}
        aria-hidden="true"
        alt=""
        className={styles.thumbBlur}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={POSTER_SIZES}
        onError={() => setHasError(true)}
        style={{ objectFit: 'cover', zIndex: 1 }}
      />
    </div>
  );
};

export default MediaPoster;
