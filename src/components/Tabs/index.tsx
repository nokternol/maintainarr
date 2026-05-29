import { cn } from '@app/lib/utils/cn';

export interface Tab<T extends string> {
  value: T;
  label: string;
  count?: number;
  loading?: boolean;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, active, onChange, className }: TabsProps<T>) {
  return (
    <div className={cn('flex items-center gap-1', className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="tab"
          aria-selected={active === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            'px-3 py-1.5 rounded-sm text-sm font-medium transition-colors',
            active === tab.value
              ? 'bg-primary text-white'
              : 'text-text-primary hover:bg-surface-hover',
          )}
        >
          {tab.label}
          {!tab.loading && tab.count !== undefined && (
            <span
              className={cn(
                'ml-1.5 text-xs',
                active === tab.value ? 'opacity-80' : 'text-text-muted',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
