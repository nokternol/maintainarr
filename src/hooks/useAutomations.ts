import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type { QueryFilters } from './useSavedQueries';

export interface AutomationDto {
  id: number;
  name: string;
  query: { id: number; name: string; filters: QueryFilters };
  provider: { id: number; name: string; type: string };
  taskId: string;
  schedule: string;
  status: 'active' | 'paused';
  lastRun?: { at: string; itemCount: number; status: 'success' | 'error'; error?: string };
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAutomationInput {
  name: string;
  queryId: number;
  providerId: number;
  taskId: string;
  schedule: string;
}

const KEY = '/api/automations';

async function fetchAutomations(url: string): Promise<AutomationDto[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch automations');
  const json = await res.json();
  return json.data as AutomationDto[];
}

async function createAutomation(
  _key: string,
  { arg }: { arg: CreateAutomationInput }
): Promise<AutomationDto> {
  const res = await fetch(KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? 'Failed to create automation');
  }
  const json = await res.json();
  return json.data as AutomationDto;
}

async function updateStatus(
  _key: string,
  { arg }: { arg: { id: number; status: 'active' | 'paused' } }
): Promise<AutomationDto> {
  const res = await fetch(`${KEY}/${arg.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: arg.status }),
  });
  if (!res.ok) throw new Error('Failed to update automation status');
  const json = await res.json();
  return json.data as AutomationDto;
}

async function deleteAutomation(_key: string, { arg }: { arg: number }): Promise<void> {
  const res = await fetch(`${KEY}/${arg}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete automation');
}

export function useAutomations() {
  const { data: automations = [], isLoading, mutate } = useSWR(KEY, fetchAutomations);

  const { trigger: triggerCreate, isMutating: isCreating } = useSWRMutation(KEY, createAutomation);
  const { trigger: triggerStatus } = useSWRMutation(KEY, updateStatus);
  const { trigger: triggerDelete } = useSWRMutation(KEY, deleteAutomation);

  const create = async (input: CreateAutomationInput): Promise<AutomationDto> => {
    const a = await triggerCreate(input);
    await mutate();
    return a!;
  };

  const setStatus = async (id: number, status: 'active' | 'paused'): Promise<void> => {
    await triggerStatus({ id, status });
    await mutate();
  };

  const remove = async (id: number): Promise<void> => {
    await triggerDelete(id);
    await mutate();
  };

  return { automations, isLoading, isCreating, create, setStatus, remove };
}
