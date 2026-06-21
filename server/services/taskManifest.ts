import { MetadataProviderType } from '../database/schema';
import type { RadarrProvider } from '../providers/radarrProvider';
import type { SonarrProvider } from '../providers/sonarrProvider';

/**
 * The server's single declaration of an actuator task: how it is presented
 * (`id`, `label`, `destructive`), what data scope it touches (`affects`), and
 * how it runs against its bound provider. The executor dispatches from these and
 * the same descriptors are served to the client.
 */
export interface TaskDescriptor {
  id: string;
  label: string;
  destructive: boolean;
  affects?: 'media';
  run: (provider: RadarrProvider | SonarrProvider, ids: number[]) => Promise<void>;
}

const MANIFEST: Partial<Record<MetadataProviderType, TaskDescriptor[]>> = {
  [MetadataProviderType.RADARR]: [
    {
      id: 'unmonitorMovie',
      label: 'Unmonitor movie',
      destructive: false,
      affects: 'media',
      run: (provider, ids) => (provider as RadarrProvider).unmonitorMovies(ids),
    },
    {
      id: 'triggerSearch',
      label: 'Trigger download search',
      destructive: false,
      run: (provider, ids) => (provider as RadarrProvider).triggerMoviesSearch(ids),
    },
    {
      id: 'deleteMovieWithFiles',
      label: 'Delete movie + files',
      destructive: true,
      affects: 'media',
      run: (provider, ids) => (provider as RadarrProvider).deleteMovies(ids),
    },
  ],
  [MetadataProviderType.SONARR]: [
    {
      id: 'unmonitorSeries',
      label: 'Unmonitor series',
      destructive: false,
      affects: 'media',
      run: (provider, ids) => (provider as SonarrProvider).unmonitorSeries(ids),
    },
    {
      id: 'triggerSearch',
      label: 'Trigger episode search',
      destructive: false,
      run: (provider, ids) => (provider as SonarrProvider).triggerSeriesSearch(ids),
    },
    {
      id: 'deleteSeriesWithFiles',
      label: 'Delete series + files',
      destructive: true,
      affects: 'media',
      run: (provider, ids) => (provider as SonarrProvider).deleteSeries(ids),
    },
  ],
};

/** The actuator tasks an owner type can run. Enricher-only types contribute none. */
export function taskManifest(type: MetadataProviderType): TaskDescriptor[] {
  return MANIFEST[type] ?? [];
}

/** A task descriptor without its `run` — the serializable shape served to clients. */
export type PublicTaskDescriptor = Omit<TaskDescriptor, 'run'>;

/**
 * The manifest projected for transport: every actuator type mapped to its tasks
 * with `run` stripped, so the client can derive its catalogue without the
 * server-only dispatch functions.
 */
export function publicTaskManifest(): Record<string, PublicTaskDescriptor[]> {
  const out: Record<string, PublicTaskDescriptor[]> = {};
  for (const [type, descriptors] of Object.entries(MANIFEST)) {
    out[type] = descriptors.map(({ run: _run, ...rest }) => rest);
  }
  return out;
}
