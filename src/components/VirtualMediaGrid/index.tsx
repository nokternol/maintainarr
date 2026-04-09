import { cn } from '@app/lib/utils/cn';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { MediaCard } from '../MediaCard';

// ─── Column breakpoints (matches Tailwind grid in MediaGrid) ──────────────────

function getColumnCount(width: number): number {
  if (width >= 1536) return 8;
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 640) return 3;
  return 2;
}

const ESTIMATED_ROW_HEIGHT = 350;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VirtualMediaGridProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  isFetchingMore?: boolean;
  isLoading?: boolean;
  skeletonCount?: number;
  className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VirtualMediaGrid<T>({
  items,
  renderItem,
  isFetchingMore = false,
  isLoading = false,
  skeletonCount = 48,
  className,
}: VirtualMediaGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setColumnCount(getColumnCount(entries[0].contentRect.width));
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
    gap: '1rem',
    width: '100%',
  };

  // ─── Initial load: flat skeleton grid, no virtualization ──────────────────

  if (isLoading) {
    return (
      <div ref={containerRef} className={className}>
        <div style={gridStyle}>
          {Array.from({ length: skeletonCount }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton placeholders
            <MediaCard.Skeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Virtual grid ─────────────────────────────────────────────────────────

  const rowCount = Math.ceil(items.length / columnCount);
  const totalRows = rowCount + (isFetchingMore ? 1 : 0);

  return (
    <VirtualRows
      containerRef={containerRef}
      items={items}
      renderItem={renderItem}
      columnCount={columnCount}
      rowCount={rowCount}
      totalRows={totalRows}
      isFetchingMore={isFetchingMore}
      gridStyle={gridStyle}
      className={className}
    />
  );
}

// ─── Inner component — separates hooks from conditional logic ─────────────────

interface VirtualRowsProps<T> {
  containerRef: React.RefObject<HTMLDivElement>;
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  columnCount: number;
  rowCount: number;
  totalRows: number;
  isFetchingMore: boolean;
  gridStyle: React.CSSProperties;
  className?: string;
}

function VirtualRows<T>({
  containerRef,
  items,
  renderItem,
  columnCount,
  rowCount,
  totalRows,
  isFetchingMore,
  gridStyle,
  className,
}: VirtualRowsProps<T>) {
  const rowVirtualizer = useWindowVirtualizer({
    count: totalRows,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isSkeletonRow = isFetchingMore && virtualRow.index === rowCount;

          if (isSkeletonRow) {
            return (
              <div
                key="fetching-more"
                style={{
                  ...gridStyle,
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                {Array.from({ length: columnCount }, (_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: stable skeleton placeholders
                  <MediaCard.Skeleton key={i} />
                ))}
              </div>
            );
          }

          const start = virtualRow.index * columnCount;
          const rowItems = items.slice(start, start + columnCount);

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              style={{
                ...gridStyle,
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowItems.map(renderItem)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default VirtualMediaGrid;
