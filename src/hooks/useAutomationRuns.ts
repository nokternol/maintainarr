import { useState } from 'react';
import useSWR from 'swr';

export interface AutomationRunDto {
  id: number;
  automationId: number;
  automationName: string;
  ranAt: string;
  status: 'success' | 'error';
  itemCount: number | null;
  error: string | null;
  createdAt: string;
}

const PAGE_SIZE = 25;

async function fetchRuns(url: string): Promise<{ data: AutomationRunDto[]; total: number }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch automation runs');
  const json = await res.json();
  return json.data as { data: AutomationRunDto[]; total: number };
}

export function useAutomationRuns(opts: { automationId?: number } = {}) {
  const [page, setPage] = useState(0);

  const params = new URLSearchParams();
  params.set('limit', String(PAGE_SIZE));
  params.set('offset', String(page * PAGE_SIZE));
  if (opts.automationId !== undefined) {
    params.set('automationId', String(opts.automationId));
  }

  const key = `/api/automations/runs?${params.toString()}`;

  const { data, isLoading, mutate } = useSWR(key, fetchRuns);

  return {
    runs: data?.data ?? [],
    total: data?.total ?? 0,
    isLoading,
    page,
    nextPage: () => setPage((p) => p + 1),
    prevPage: () => setPage((p) => Math.max(0, p - 1)),
    refresh: mutate,
  };
}
