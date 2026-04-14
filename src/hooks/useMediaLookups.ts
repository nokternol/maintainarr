import useSWR from 'swr';

export interface MediaTag {
  id: number;
  label: string;
}

export interface MediaQualityProfile {
  id: number;
  name: string;
}

interface TagsResponse {
  radarr: MediaTag[];
  sonarr: MediaTag[];
}

interface QualityProfilesResponse {
  radarr: MediaQualityProfile[];
  sonarr: MediaQualityProfile[];
}

interface GenresResponse {
  movies: string[];
  series: string[];
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  const json = await res.json();
  return json.data as T;
}

export function useMediaLookups() {
  const { data: tagsData } = useSWR<TagsResponse>('/api/media/tags', fetcher);
  const { data: profilesData } = useSWR<QualityProfilesResponse>(
    '/api/media/quality-profiles',
    fetcher
  );
  const { data: genresData } = useSWR<GenresResponse>('/api/media/genres', fetcher);
  const { data: networksData } = useSWR<string[]>('/api/media/networks', fetcher);

  return {
    tags: {
      radarr: tagsData?.radarr ?? [],
      sonarr: tagsData?.sonarr ?? [],
    },
    qualityProfiles: {
      radarr: profilesData?.radarr ?? [],
      sonarr: profilesData?.sonarr ?? [],
    },
    genres: {
      movies: genresData?.movies ?? [],
      series: genresData?.series ?? [],
    },
    networks: networksData ?? [],
  };
}
