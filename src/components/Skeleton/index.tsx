// src/components/Skeleton/index.tsx
import { cn } from '@app/lib/utils/cn';
import styles from './Skeleton.module.css';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div data-testid="skeleton" className={cn(styles.skeleton, className)} {...props} />;
}

export { Skeleton };
