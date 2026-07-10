import { getChildLogger } from '@server/kernel/logger';
import {
  mediaSourceFor,
  radarrMediaSource,
  sonarrMediaSource,
} from '@server/modules/media/sourceAdapters';
import type { ProviderConfig } from '@server/modules/providers/connections/baseProviderConnection';
import { RadarrProvider } from '@server/modules/providers/connections/radarrProvider';
import type { RadarrMovie } from '@server/modules/providers/connections/radarrProvider';
import { SonarrProvider } from '@server/modules/providers/connections/sonarrProvider';
import type { SonarrSeries } from '@server/modules/providers/connections/sonarrProvider';
import { describe, expect, it, vi } from 'vitest';

const mockLogger = getChildLogger('TestSourceAdapters');

const mockConfig: ProviderConfig = {
  name: 'Test Provider',
  url: 'http://localhost',
  apiKey: 'fake-api-key',
  settings: {},
};

const movie: RadarrMovie = {
  id: 1,
  title: 'The Matrix',
  hasFile: true,
  monitored: true,
  tmdbId: 603,
  profileId: 1,
  qualityProfileId: 1,
  tags: [],
  folderName: '',
  path: '',
};

const series: SonarrSeries = {
  id: 1,
  title: 'Breaking Bad',
  status: 'ended',
  monitored: true,
  tvdbId: 81189,
  profileId: 1,
  qualityProfileId: 1,
  languageProfileId: 1,
  tags: [],
  path: '',
  seasons: [],
};

describe('radarrMediaSource', () => {
  it('adapts a RadarrProvider into a MediaSource over normalized items', async () => {
    const radarr = new RadarrProvider(mockConfig, mockLogger);
    vi.spyOn(radarr, 'getMovies').mockResolvedValue([movie]);

    const source = radarrMediaSource(radarr);
    const items = await source.getMediaItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('The Matrix');
    expect(source.idOf(items[0])).toBe(1);
    expect(source.enrichmentSourceType).toBe('RADARR');
  });
});

describe('sonarrMediaSource', () => {
  it('adapts a SonarrProvider into a MediaSource over normalized items', async () => {
    const sonarr = new SonarrProvider(mockConfig, mockLogger);
    vi.spyOn(sonarr, 'getSeries').mockResolvedValue([series]);

    const source = sonarrMediaSource(sonarr);
    const items = await source.getMediaItems();

    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Breaking Bad');
    expect(source.idOf(items[0])).toBe(1);
    expect(source.enrichmentSourceType).toBe('SONARR');
  });
});

describe('mediaSourceFor', () => {
  it('dispatches a RadarrProvider to radarrMediaSource', () => {
    const radarr = new RadarrProvider(mockConfig, mockLogger);
    expect(mediaSourceFor(radarr).enrichmentSourceType).toBe('RADARR');
  });

  it('dispatches a SonarrProvider to sonarrMediaSource', () => {
    const sonarr = new SonarrProvider(mockConfig, mockLogger);
    expect(mediaSourceFor(sonarr).enrichmentSourceType).toBe('SONARR');
  });
});
