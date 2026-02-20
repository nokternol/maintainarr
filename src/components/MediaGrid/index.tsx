import { cn } from '@app/lib/utils/cn';
import type React from 'react';
import LoadingSpinner from '../LoadingSpinner';
import styles from './MediaGrid.module.css';

export interface MediaGridProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoading?: boolean;
  className?: string;
}

export const MediaGrid = <T,>({
  items,
  renderItem,
  hasMore,
  isLoading,
  onLoadMore,
  className = '',
}: MediaGridProps<T>) => {
  return (
    <div className={styles.container}>
      <div className={cn(styles.grid, className)}>{items.map(renderItem)}</div>
      {hasMore && !isLoading && (
        <div
          data-testid="load-more-trigger"
          className={styles.loadMoreTrigger}
          {...(onLoadMore ? { onClick: onLoadMore } : {})}
        />
      )}
      {isLoading && (
        <div className={styles.loadingContainer}>
          <LoadingSpinner size="md" />
        </div>
      )}
    </div>
  );
};

export default MediaGrid;
