import useSWR from 'swr';

/** One choice a `select`-parameter task's control offers, from a live provider fetch. */
export interface ProviderTaskOption {
  id: string;
  label: string;
}

/** A configured actuator instance and the options it offers for one route. */
export interface ProviderTaskOptionsAvailability {
  providerId: number;
  type: string;
  options: ProviderTaskOption[];
}

async function fetcher(url: string): Promise<ProviderTaskOptionsAvailability[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch task options');
  const json = await res.json();
  return json.data as ProviderTaskOptionsAvailability[];
}

/** The options one provider instance offers for a route — empty if it declares none. */
export function optionsForProvider(
  availability: ProviderTaskOptionsAvailability[] | undefined,
  providerId: number
): ProviderTaskOption[] {
  return availability?.find((a) => a.providerId === providerId)?.options ?? [];
}

/**
 * Instance-keyed live choices for a `select`-parameter task, fetched from its
 * `optionsRoute`. `route` is `undefined` when the selected task has no
 * `select` parameter — the fetch is skipped rather than requested with an
 * invalid route.
 */
export function useProviderTaskOptions(route: string | undefined): {
  availability: ProviderTaskOptionsAvailability[] | undefined;
  isLoading: boolean;
  error: unknown;
} {
  const { data, error, isLoading } = useSWR<ProviderTaskOptionsAvailability[]>(
    route ? `/api/providers/task-options/${route}` : null,
    fetcher
  );
  return { availability: data, isLoading, error };
}
