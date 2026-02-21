import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export default function Card({
  children,
  variant = 'default',
  padding = 'md',
  header,
  footer,
  className = '',
  ...props
}: CardProps) {
  const isDivided = Boolean(header || footer);

  return (
    <div
      className={cn(
        styles.base,
        styles[variant],
        !isDivided && styles[`padding_${padding}`],
        className
      )}
      {...props}
    >
      {header && (
        <div className={cn(styles.header, styles[`headerPadding_${padding}`])}>{header}</div>
      )}
      {isDivided ? (
        <div className={styles[`contentPadding_divided_${padding}`]}>{children}</div>
      ) : (
        children
      )}
      {footer && (
        <div className={cn(styles.footer, styles[`footerPadding_${padding}`])}>{footer}</div>
      )}
    </div>
  );
}
