import { useState } from 'react';

export interface SearchResult {
  providerId: number;
  name: string;
  type: string;
  status: 'ok' | 'error' | 'unavailable';
  data?: unknown;
  error?: string;
}

export function useMetadataSearch() {
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const search = async (title: string) => {
    if (!title.trim()) return;
    setIsLoading(true);
    setError(undefined);
    setResults(null);
    try {
      const params = new URLSearchParams({ title });
      const res = await fetch(`/api/search/metadata?${params}`);
      if (!res.ok) throw new Error(`Search failed: ${res.status}`);
      const json = await res.json();
      setResults(json.data as SearchResult[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  };

  return { search, results, isLoading, error };
}
