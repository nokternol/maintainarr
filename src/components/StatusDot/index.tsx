import { cn } from '@app/lib/utils/cn';

export default function StatusDot({ status }: { status: 'active' | 'paused' | 'error' }) {
  return (
    <span
      className={cn(
        'inline-block w-2 h-2 rounded-full flex-shrink-0 mt-[3px]',
        status === 'active' && 'bg-primary',
        status === 'paused' && 'bg-warning',
        status === 'error' && 'bg-danger'
      )}
      aria-hidden="true"
    />
  );
}
