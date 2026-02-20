import type { HTMLAttributes } from 'react';

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
  const baseStyles = 'rounded-lg transition-colors';

  const variantStyles = {
    default: 'bg-slate-900',
    outlined: 'bg-slate-900 border border-slate-700',
    elevated: 'bg-slate-900 shadow-lg shadow-black/20',
  };

  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const headerPaddingStyles = {
    none: 'px-0 pt-0 pb-0',
    sm: 'px-3 pt-3 pb-2',
    md: 'px-4 pt-4 pb-3',
    lg: 'px-6 pt-6 pb-4',
  };

  const footerPaddingStyles = {
    none: 'px-0 pt-0 pb-0',
    sm: 'px-3 pt-2 pb-3',
    md: 'px-4 pt-3 pb-4',
    lg: 'px-6 pt-4 pb-6',
  };

  const contentPaddingStyles = {
    none: '',
    sm: header || footer ? 'px-3 py-2' : 'p-3',
    md: header || footer ? 'px-4 py-3' : 'p-4',
    lg: header || footer ? 'px-6 py-4' : 'p-6',
  };

  return (
    <div
      className={`${baseStyles} ${variantStyles[variant]} ${!header && !footer ? paddingStyles[padding] : ''} ${className}`}
      {...props}
    >
      {header && (
        <div className={`${headerPaddingStyles[padding]} border-b border-slate-700`}>{header}</div>
      )}
      {header || footer ? (
        <div className={contentPaddingStyles[padding]}>{children}</div>
      ) : (
        children
      )}
      {footer && (
        <div className={`${footerPaddingStyles[padding]} border-t border-slate-700`}>{footer}</div>
      )}
    </div>
  );
}
