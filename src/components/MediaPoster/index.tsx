import { cn } from '@app/lib/utils/cn';
import Image from 'next/image';
import { useState } from 'react';
import styles from './MediaPoster.module.css';

// 1×1 dark pixel — static blur placeholder shown by next/image while the
// real poster loads. No per-poster fetch needed; blur is purely aesthetic.
const STATIC_BLUR =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoH' +
  'BwYIDAoMCwsKCwsNCxAQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQME' +
  'BAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQU' +
  'FBQUFBQUFBT/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/' +
  'EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAA' +
  'AAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/ACWQAB//2Q==';

// Matches the VirtualMediaGrid / MediaGrid responsive column breakpoints.
const POSTER_SIZES = [
  '(min-width: 1536px) 12.5vw',
  '(min-width: 1280px) 16.67vw',
  '(min-width: 1024px) 20vw',
  '(min-width: 768px) 25vw',
  '(min-width: 640px) 33.33vw',
  '50vw',
].join(', ');

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
      <Image
        src={src}
        alt={alt}
        fill
        placeholder="blur"
        blurDataURL={STATIC_BLUR}
        sizes={POSTER_SIZES}
        onError={() => setHasError(true)}
        style={{ objectFit: 'cover' }}
      />
    </div>
  );
};

export default MediaPoster;
