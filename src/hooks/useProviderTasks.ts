import useSWR from 'swr';

/**
 * One actuator task as the server projects it for discovery: the descriptor
 * fields plus whether it is enabled on this provider instance. Mirrors the
 * server's `ActuatorTaskDescriptor` (no runner crosses the wire); `enabled`
 * is added per instance by `GET /api/providers/tasks`.
 */
/** Mirrors the server's `ActuatorTaskParameter` — see `server/modules/providers/roles.ts`. */
export type ProviderTaskParameter =
  | { type: 'select'; label: string; optionsRoute: string }
  | { type: 'text'; label: string }
  | {
      type: 'fields';
      label: string;
      fields: Array<{
        key: string;
        label: string;
        kind: 'select' | 'text' | 'boolean';
        optionsRoute?: string;
      }>;
    };

export interface ProviderTaskDescriptor {
  id: string;
  label: string;
  destructive: boolean;
  affects?: 'media';
  /** Declared when the task takes one or more values, captured with the automation. */
  parameter?: ProviderTaskParameter;
  enabled: boolean;
}

/** A configured actuator instance and the tasks it declares. Non-actuators are absent. */
export interface ProviderTaskAvailability {
  providerId: number;
  type: string;
  tasks: ProviderTaskDescriptor[];
}

const KEY = '/api/providers/tasks';

async function fetcher(url: string): Promise<ProviderTaskAvailability[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch provider tasks');
  const json = await res.json();
  return json.data as ProviderTaskAvailability[];
}

/** The tasks declared by one provider instance — empty if it declares none (or is no actuator). */
export function tasksForProvider(
  availability: ProviderTaskAvailability[] | undefined,
  providerId: number
): ProviderTaskDescriptor[] {
  return availability?.find((a) => a.providerId === providerId)?.tasks ?? [];
}

/**
 * Instance-keyed actuator task availability, the single source of what tasks
 * exist client-side. The server owns the catalogue; the client derives from it.
 */
export function useProviderTasks(): {
  availability: ProviderTaskAvailability[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, error, isLoading } = useSWR<ProviderTaskAvailability[]>(KEY, fetcher);
  return { availability: data, isLoading, error };
}
