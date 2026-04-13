import { cn } from '@app/lib/utils/cn';
import { useVirtualizer } from '@tanstack/react-virtual';
import type React from 'react';
import { useContext, useEffect, useRef, useState } from 'react';
import { ScrollContainerContext } from '../AppLayout';
import { MediaCard } from '../MediaCard';

// ─── Column breakpoints ────────────────────────────────────────────────────────
// Uses container width (not viewport) so sidebar-narrowed areas get correct cols.
// 520px threshold prevents the "2 huge columns" problem at tablet (sidebar ~220px
// narrows a 768px viewport to ~548px, which was previously trapped at 2 cols).

function getColumnCount(width: number): number {
  if (width >= 1536) return 8;
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 768) return 4;
  if (width >= 480) return 3;
  return 2;
}

function getEstimatedRowHeight(cols: number): number {
  if (cols <= 2) return 480;
  if (cols === 3) return 380;
  return 320;
}

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
  // measureRef stays mounted across loading transitions — ResizeObserver always
  // observes this stable div so column count never resets to 0.
  const measureRef = useRef<HTMLDivElement>(null);
  const [columnCount, setColumnCount] = useState(4);

  useEffect(() => {
    if (!measureRef.current) return;
    const observer = new ResizeObserver((entries) => {
      setColumnCount(getColumnCount(entries[0].contentRect.width));
    });
    observer.observe(measureRef.current);
    return () => observer.disconnect();
  }, []);

  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
    gap: columnCount <= 2 ? '0.75rem' : '1rem',
    width: '100%',
  };

  // ─── Initial load: flat skeleton grid, no virtualization ──────────────────

  if (isLoading) {
    return (
      <div ref={measureRef} className={className}>
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
    <div ref={measureRef} className={className}>
      <VirtualRows
        items={items}
        renderItem={renderItem}
        columnCount={columnCount}
        rowCount={rowCount}
        totalRows={totalRows}
        isFetchingMore={isFetchingMore}
        gridStyle={gridStyle}
      />
    </div>
  );
}

// ─── Inner component — separates hooks from conditional logic ─────────────────

interface VirtualRowsProps<T> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  columnCount: number;
  rowCount: number;
  totalRows: number;
  isFetchingMore: boolean;
  gridStyle: React.CSSProperties;
}

function VirtualRows<T>({
  items,
  renderItem,
  columnCount,
  rowCount,
  totalRows,
  isFetchingMore,
  gridStyle,
}: VirtualRowsProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollElement = useContext(ScrollContainerContext);

  const rowVirtualizer = useVirtualizer({
    count: totalRows,
    estimateSize: () => getEstimatedRowHeight(columnCount),
    overscan: 5,
    getScrollElement: () =>
      scrollElement.current ?? (typeof document !== 'undefined' ? document.documentElement : null),
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div ref={containerRef} className="relative">
      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const isSkeletonRow = isFetchingMore && virtualRow.index === rowCount;

          if (isSkeletonRow) {
            return (
              <div
                key="fetching-more"
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                style={{
                  ...gridStyle,
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`,
                  paddingBottom: '1rem',
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
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                ...gridStyle,
                position: 'absolute',
                top: 0,
                transform: `translateY(${virtualRow.start}px)`,
                paddingBottom: '1rem',
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
