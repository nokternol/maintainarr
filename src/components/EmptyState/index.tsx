import type { HTMLAttributes } from 'react';

interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 ${className}`}
      {...props}
    >
      {icon && <div className="mb-4 text-slate-600">{icon}</div>}
      <h3 className="text-xl font-semibold text-slate-300 mb-2">{title}</h3>
      {description && <p className="text-slate-500 mb-6 max-w-md">{description}</p>}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
