import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './WidgetGrid.module.css';

interface WidgetGridProps extends HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4;
  gap?: 'sm' | 'md' | 'lg';
}

export default function WidgetGrid({
  children,
  columns = 4,
  gap = 'md',
  className = '',
  ...props
}: WidgetGridProps) {
  return (
    <div
      className={cn(
        styles.gridContainer,
        styles[`cols_${columns}`],
        styles[`gap_${gap}`],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
