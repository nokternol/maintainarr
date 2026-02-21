import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  // We'll keep these intents but map them to your theme colors
  variant?: 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' | 'teal';
  size?: 'sm' | 'md' | 'lg';
}

export default function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  ...props
}: BadgeProps) {
  return (
    <span className={cn(styles.base, styles[variant], styles[size], className)} {...props}>
      {children}
    </span>
  );
}
