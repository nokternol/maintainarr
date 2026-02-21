import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './TopBar.module.css';

interface Breadcrumb {
  label: string;
  href?: string;
}

interface TopBarProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  sticky?: boolean;
}

export default function TopBar({
  title,
  breadcrumbs,
  actions,
  sticky = false,
  className = '',
  ...props
}: TopBarProps) {
  return (
    <div className={cn(styles.container, sticky && styles.isSticky, className)} {...props}>
      <div className={styles.inner}>
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className={styles.breadcrumbsNav}>
              {breadcrumbs.map((crumb, index) => (
                <div key={`breadcrumb-${crumb.label}-${index}`} className={styles.breadcrumbItem}>
                  {crumb.href ? (
                    <a href={crumb.href} className={styles.breadcrumbLink}>
                      {crumb.label}
                    </a>
                  ) : (
                    <span>{crumb.label}</span>
                  )}
                  {index < breadcrumbs.length - 1 && <span>/</span>}
                </div>
              ))}
            </nav>
          )}
          {title && <h1 className={styles.title}>{title}</h1>}
        </div>

        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
    </div>
  );
}
