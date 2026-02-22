import type { AggregatedRatings } from '@app/components/RatingsDisplay';
import useSWRMutation from 'swr/mutation';

interface FetchRatingsArgs {
  title: string;
  year?: number;
  tmdbApiKey?: string;
  omdbApiKey?: string;
}

async function fetchRatings(
  _key: string,
  { arg }: { arg: FetchRatingsArgs }
): Promise<AggregatedRatings> {
  const params = new URLSearchParams({ title: arg.title });

  if (arg.year !== undefined) {
    params.append('year', String(arg.year));
  }
  if (arg.tmdbApiKey) {
    params.append('tmdbApiKey', arg.tmdbApiKey);
  }
  if (arg.omdbApiKey) {
    params.append('omdbApiKey', arg.omdbApiKey);
  }

  const response = await fetch(`/api/providers/ratings?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch ratings');
  }

  const result = await response.json();
  return result.data as AggregatedRatings;
}

export function useRatings() {
  const { trigger, data, error, isMutating } = useSWRMutation(
    '/api/providers/ratings',
    fetchRatings
  );

  return {
    trigger,
    data,
    error: error as Error | undefined,
    isLoading: isMutating,
  };
}
