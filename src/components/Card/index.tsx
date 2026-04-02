import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './Card.module.css';

// ─── Types ───────────────────────────────────────────────────────────────────

type CardPadding = 'none' | 'sm' | 'md' | 'lg';
type CardVariant = 'default' | 'outlined' | 'elevated';

// ─── Root ─────────────────────────────────────────────────────────────────────

export interface CardRootProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /**
   * Padding applied when there are no Header / Footer sub-components.
   * If you slot in <Card.Header> or <Card.Footer>, use those sub-components
   * to control their own padding, and wrap body content in <Card.Content>.
   */
  padding?: CardPadding;
}

const Root = ({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: CardRootProps) => (
  <div
    className={cn(styles.base, styles[variant], styles[`padding_${padding}`], className)}
    {...props}
  >
    {children}
  </div>
);

// ─── Sub-components ───────────────────────────────────────────────────────────

export interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

/** Renders a top slot separated by a border-bottom. */
const Header = ({ children, padding = 'md', className, ...props }: CardHeaderProps) => (
  <div className={cn(styles.header, styles[`headerPadding_${padding}`], className)} {...props}>
    {children}
  </div>
);

export interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  divided?: boolean;
}

/** Body section; use `divided` when adjacent to a Header or Footer slot. */
const Content = ({
  children,
  padding = 'md',
  divided = false,
  className,
  ...props
}: CardContentProps) => (
  <div
    className={cn(
      divided
        ? styles[`contentPadding_divided_${padding}`]
        : styles[`contentPadding_undivided_${padding}`],
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
}

/** Renders a bottom slot separated by a border-top. */
const Footer = ({ children, padding = 'md', className, ...props }: CardFooterProps) => (
  <div className={cn(styles.footer, styles[`footerPadding_${padding}`], className)} {...props}>
    {children}
  </div>
);

// ─── Exports ──────────────────────────────────────────────────────────────────

export const Card = Object.assign(Root, {
  Header,
  Content,
  Footer,
});

export default Card;
