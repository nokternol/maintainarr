import type { Story } from '@ladle/react';
import ProviderPanel from './index';

export const Sonarr: Story = () => (
  <div className="bg-surface-bg p-8">
    <ProviderPanel
      title="Sonarr"
      type="SONARR"
      onFetch={(params) => console.log('Fetch:', params)}
    />
  </div>
);

export const SonarrWithData: Story = () => (
  <div className="bg-surface-bg p-8">
    <ProviderPanel
      title="Sonarr"
      type="SONARR"
      onFetch={(params) => console.log('Fetch:', params)}
      data={{
        series: [
          { id: 1, title: 'Breaking Bad', status: 'ended', monitored: true },
          { id: 2, title: 'Better Call Saul', status: 'ended', monitored: true },
        ],
        qualityProfiles: [
          { id: 1, name: 'HD-1080p' },
          { id: 2, name: 'Ultra-HD' },
        ],
        rootFolders: [{ id: 1, path: '/tv', freeSpace: 2000000000 }],
        tags: [
          { id: 1, label: 'drama' },
          { id: 2, label: 'comedy' },
        ],
      }}
    />
  </div>
);

export const Jellyfin: Story = () => (
  <div className="bg-surface-bg p-8">
    <ProviderPanel
      title="Jellyfin"
      type="JELLYFIN"
      onFetch={(params) => console.log('Fetch:', params)}
    />
  </div>
);

export const Loading: Story = () => (
  <div className="bg-surface-bg p-8">
    <ProviderPanel
      title="Plex"
      type="PLEX"
      onFetch={(params) => console.log('Fetch:', params)}
      isLoading={true}
    />
  </div>
);

export const WithError: Story = () => (
  <div className="bg-surface-bg p-8">
    <ProviderPanel
      title="Radarr"
      type="RADARR"
      onFetch={(params) => console.log('Fetch:', params)}
      error="Failed to connect to Radarr. Please check your URL and API key."
    />
  </div>
);
