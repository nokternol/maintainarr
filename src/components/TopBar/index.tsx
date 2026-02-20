import type { HTMLAttributes } from 'react';

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
  const positionClass = sticky ? 'sticky top-0 z-10' : '';

  return (
    <div
      className={`bg-slate-900 border-b border-slate-700 px-6 py-4 ${positionClass} ${className}`}
      {...props}
    >
      <div className="flex items-center justify-between">
        <div>
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-2 text-sm text-slate-400 mb-1">
              {breadcrumbs.map((crumb, index) => (
                <div key={`breadcrumb-${crumb.label}-${index}`} className="flex items-center gap-2">
                  {crumb.href ? (
                    <a href={crumb.href} className="hover:text-teal-400 transition-colors">
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
          {title && <h1 className="text-2xl font-bold text-white">{title}</h1>}
        </div>

        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
