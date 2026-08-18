import useSWR from 'swr';

export interface MediaTag {
  id: number;
  label: string;
  /** The instance this tag was fetched from — always set by the server (`listTags`). */
  providerId: number;
  providerName: string;
}

export interface MediaQualityProfile {
  id: number;
  name: string;
  /** The instance this profile was fetched from — always set by the server (`listQualityProfiles`). */
  providerId: number;
  providerName: string;
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
  const { data: studioData } = useSWR<string[]>('/api/media/studio', fetcher);
  const { data: releaseGroupsData } = useSWR<string[]>('/api/media/release-groups', fetcher);
  const { data: collectionNamesData } = useSWR<string[]>('/api/media/collection-names', fetcher);
  const { data: fileContainersData } = useSWR<string[]>('/api/media/file-containers', fetcher);
  const { data: videoCodecsData } = useSWR<string[]>('/api/media/video-codecs', fetcher);
  const { data: audioCodecsData } = useSWR<string[]>('/api/media/audio-codecs', fetcher);
  const { data: fileResolutionsData } = useSWR<string[]>('/api/media/file-resolutions', fetcher);
  const { data: labelsData } = useSWR<string[]>('/api/media/labels', fetcher);

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
    studio: studioData ?? [],
    releaseGroups: releaseGroupsData ?? [],
    collectionNames: collectionNamesData ?? [],
    fileContainers: fileContainersData ?? [],
    videoCodecs: videoCodecsData ?? [],
    audioCodecs: audioCodecsData ?? [],
    fileResolutions: fileResolutionsData ?? [],
    labels: labelsData ?? [],
  };
}
