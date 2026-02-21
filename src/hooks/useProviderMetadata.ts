import useSWRMutation from 'swr/mutation';

type ProviderType = 'SONARR' | 'RADARR' | 'PLEX' | 'JELLYFIN' | 'TAUTULLI' | 'OVERSEERR';

interface FetchMetadataConfig {
  type: ProviderType;
  url: string;
  apiKey: string;
  settings?: string;
}

interface ProviderMetadataResponse {
  type: ProviderType;
  data: Record<string, unknown>;
}

async function fetchProviderMetadata(
  _key: string,
  { arg }: { arg: FetchMetadataConfig }
): Promise<ProviderMetadataResponse> {
  const params = new URLSearchParams({
    type: arg.type,
    url: arg.url,
    apiKey: arg.apiKey,
  });

  if (arg.settings) {
    params.append('settings', arg.settings);
  }

  const response = await fetch(`/api/providers/metadata?${params.toString()}`);

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || 'Failed to fetch provider metadata');
  }

  const result = await response.json();
  return result.data;
}

export function useProviderMetadata() {
  const { trigger, data, error, isMutating } = useSWRMutation(
    '/api/providers/metadata',
    fetchProviderMetadata
  );

  return {
    trigger,
    data,
    error: error as Error | undefined,
    isLoading: isMutating,
  };
}
