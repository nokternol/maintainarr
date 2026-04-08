import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';

export interface ProviderSummary {
  id: number;
  type: string;
  name: string;
  url: string;
  apiKey: '***' | null;
  settings: Record<string, unknown> | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProviderParams {
  type: string;
  name: string;
  url: string;
  apiKey?: string;
  settings?: Record<string, unknown>;
  isActive?: boolean;
}

export interface UpdateProviderParams {
  name?: string;
  url?: string;
  apiKey?: string;
  isActive?: boolean;
}

const KEY = '/api/settings/providers';

async function fetcher(url: string): Promise<ProviderSummary[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch providers');
  const json = await res.json();
  return json.data as ProviderSummary[];
}

async function createProvider(
  _key: string,
  { arg }: { arg: CreateProviderParams }
): Promise<ProviderSummary> {
  const res = await fetch(KEY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg),
  });
  if (!res.ok) throw new Error('Failed to create provider');
  const json = await res.json();
  return json.data as ProviderSummary;
}

async function updateProvider(
  _key: string,
  { arg }: { arg: { id: number; patch: UpdateProviderParams } }
): Promise<ProviderSummary> {
  const res = await fetch(`${KEY}/${arg.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(arg.patch),
  });
  if (!res.ok) throw new Error('Failed to update provider');
  const json = await res.json();
  return json.data as ProviderSummary;
}

async function deleteProvider(_key: string, { arg }: { arg: number }): Promise<void> {
  const res = await fetch(`${KEY}/${arg}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete provider');
}

export function useProviderSettings() {
  const { data: providers, isLoading, error, mutate } = useSWR(KEY, fetcher);

  const { trigger: triggerCreate } = useSWRMutation(KEY, createProvider);
  const { trigger: triggerUpdate } = useSWRMutation(KEY, updateProvider);
  const { trigger: triggerDelete } = useSWRMutation(KEY, deleteProvider);

  const create = async (params: CreateProviderParams): Promise<ProviderSummary> => {
    const result = await triggerCreate(params);
    await mutate();
    return result!;
  };

  const update = async (id: number, patch: UpdateProviderParams): Promise<ProviderSummary> => {
    const result = await triggerUpdate({ id, patch });
    await mutate();
    return result!;
  };

  const remove = async (id: number): Promise<void> => {
    await triggerDelete(id);
    await mutate();
  };

  return {
    providers,
    isLoading,
    error: error as Error | undefined,
    create,
    update,
    remove,
  };
}
