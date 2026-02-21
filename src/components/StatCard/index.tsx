import { cn } from '@app/lib/utils/cn';
import type { HTMLAttributes } from 'react';
import styles from './StatCard.module.css';

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
  const trendColor = trend?.direction === 'up' ? styles.trendUp : styles.trendDown;
  const trendIcon = trend?.direction === 'up' ? '↑' : '↓';

  return (
    <div className={cn(styles.card, className)} {...props}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className={styles.label}>{label}</p>
          <p className={styles.value}>{value}</p>
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          {trend && (
            <div className={cn(styles.trendWrapper, trendColor)}>
              <span>{trendIcon}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && <div className={styles.iconWrapper}>{icon}</div>}
      </div>
    </div>
  );
}
