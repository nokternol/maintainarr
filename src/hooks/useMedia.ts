import useSWR from 'swr';

export interface MediaImage {
  coverType: string;
  remoteUrl: string;
}

export interface ManagedMovie {
  id: number;
  title: string;
  year?: number;
  hasFile: boolean;
  monitored: boolean;
  tmdbId: number;
  images?: MediaImage[];
}

export interface ManagedSeries {
  id: number;
  title: string;
  year?: number;
  status: string;
  monitored: boolean;
  tvdbId: number;
  images?: MediaImage[];
}

export interface MediaError {
  provider: string;
  error: string;
}

interface MediaResult {
  movies: ManagedMovie[];
  series: ManagedSeries[];
  errors: MediaError[];
}

async function fetcher(url: string): Promise<MediaResult> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch media');
  const json = await res.json();
  return json.data as MediaResult;
}

export function useMedia() {
  const { data, isLoading, error } = useSWR('/api/media', fetcher);

  return {
    movies: data?.movies,
    series: data?.series,
    errors: data?.errors,
    isLoading,
    error: error as Error | undefined,
  };
}
