import type { HTMLAttributes } from 'react';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  value: string | number;
  label: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  subtitle?: string;
}

export default function StatCard({
  value,
  label,
  icon,
  trend,
  subtitle,
  className = '',
  ...props
}: StatCardProps) {
  const trendColor = trend?.direction === 'up' ? 'text-emerald-500' : 'text-red-500';
  const trendIcon = trend?.direction === 'up' ? '↑' : '↓';

  return (
    <div
      className={`bg-slate-900 rounded-lg p-6 border border-slate-700 transition-colors hover:border-slate-600 ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-slate-500 mb-1">{label}</p>
          <p className="text-3xl font-bold text-white mb-1">{value}</p>
          {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
          {trend && (
            <div className={`flex items-center gap-1 text-sm font-medium mt-2 ${trendColor}`}>
              <span>{trendIcon}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && <div className="text-slate-600 ml-4">{icon}</div>}
      </div>
    </div>
  );
}
