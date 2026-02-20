import { cn } from '@app/lib/utils/cn';
import React, { useState } from 'react';
import { Skeleton } from '../Skeleton';
import styles from './MediaPoster.module.css';

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
  const [isLoading, setIsLoading] = useState(true);

  // Aspect ratio mapping
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
      {isLoading && <Skeleton className={styles.skeleton} />}
      <img
        src={src}
        alt={alt}
        className={cn(styles.image, isLoading ? styles.imageLoading : styles.imageLoaded)}
        onError={() => setHasError(true)}
        onLoad={() => setIsLoading(false)}
      />
    </div>
  );
};

export default MediaPoster;
