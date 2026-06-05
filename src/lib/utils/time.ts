import cronstrue from 'cronstrue';

export function relativeTime(isoOrDate: string | Date): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const past = diffMs < 0;

  if (abs < 60_000) return past ? 'just now' : 'in <1m';
  if (abs < 3_600_000) {
    const m = Math.round(abs / 60_000);
    return past ? `${m}m ago` : `in ${m}m`;
  }
  if (abs < 86_400_000) {
    const h = Math.round(abs / 3_600_000);
    return past ? `${h}h ago` : `in ${h}h`;
  }
  const d = Math.round(abs / 86_400_000);
  return past ? `${d}d ago` : `in ${d}d`;
}

export function safeHumanSchedule(cron: string): string {
  try {
    return cronstrue.toString(cron, { use24HourTimeFormat: true });
  } catch {
    return 'Invalid cron expression';
  }
}
