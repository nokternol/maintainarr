import AppLayout from '@app/components/AppLayout';
import ProviderPanel from '@app/components/ProviderPanel';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import WidgetGrid from '@app/components/WidgetGrid';
import { useProviderMetadata } from '@app/hooks/useProviderMetadata';
import type { SidebarItem } from '@app/types/navigation';
import { useState } from 'react';

// Icons (reusing from dashboard)
const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    href: '/dashboard',
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: <SettingsIcon />,
    href: '/providers',
    active: true,
  },
];

type ProviderType = 'SONARR' | 'RADARR' | 'PLEX' | 'JELLYFIN' | 'TAUTULLI' | 'OVERSEERR';

interface ProviderState {
  data?: Record<string, unknown>;
  error?: string;
  isLoading: boolean;
}

type ProvidersState = Record<ProviderType, ProviderState>;

export default function ProvidersPage() {
  const { trigger } = useProviderMetadata();
  const [providers, setProviders] = useState<ProvidersState>({
    PLEX: { isLoading: false },
    JELLYFIN: { isLoading: false },
    SONARR: { isLoading: false },
    RADARR: { isLoading: false },
    TAUTULLI: { isLoading: false },
    OVERSEERR: { isLoading: false },
  });

  const handleFetch = async (params: {
    type: ProviderType;
    url: string;
    apiKey: string;
    settings?: string;
  }) => {
    setProviders((prev) => ({
      ...prev,
      [params.type]: { isLoading: true, error: undefined, data: undefined },
    }));

    try {
      const result = await trigger(params);
      setProviders((prev) => ({
        ...prev,
        [params.type]: { isLoading: false, data: result?.data },
      }));
    } catch (err) {
      setProviders((prev) => ({
        ...prev,
        [params.type]: {
          isLoading: false,
          error: err instanceof Error ? err.message : 'Failed to fetch metadata',
        },
      }));
    }
  };

  return (
    <AppLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          logo={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-text-primary font-bold">
                M
              </div>
              <span className="text-xl font-bold text-text-primary">Maintainarr</span>
            </div>
          }
        />
      }
      topBar={
        <TopBar
          title="Provider Metadata"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Providers' }]}
        />
      }
    >
      <div className="p-6 space-y-6">
        <WidgetGrid columns={2}>
          <ProviderPanel
            title="Plex"
            type="PLEX"
            onFetch={handleFetch}
            isLoading={providers.PLEX.isLoading}
            error={providers.PLEX.error}
            data={providers.PLEX.data}
          />
          <ProviderPanel
            title="Jellyfin"
            type="JELLYFIN"
            onFetch={handleFetch}
            isLoading={providers.JELLYFIN.isLoading}
            error={providers.JELLYFIN.error}
            data={providers.JELLYFIN.data}
          />
          <ProviderPanel
            title="Sonarr"
            type="SONARR"
            onFetch={handleFetch}
            isLoading={providers.SONARR.isLoading}
            error={providers.SONARR.error}
            data={providers.SONARR.data}
          />
          <ProviderPanel
            title="Radarr"
            type="RADARR"
            onFetch={handleFetch}
            isLoading={providers.RADARR.isLoading}
            error={providers.RADARR.error}
            data={providers.RADARR.data}
          />
          <ProviderPanel
            title="Tautulli"
            type="TAUTULLI"
            onFetch={handleFetch}
            isLoading={providers.TAUTULLI.isLoading}
            error={providers.TAUTULLI.error}
            data={providers.TAUTULLI.data}
          />
          <ProviderPanel
            title="Overseerr"
            type="OVERSEERR"
            onFetch={handleFetch}
            isLoading={providers.OVERSEERR.isLoading}
            error={providers.OVERSEERR.error}
            data={providers.OVERSEERR.data}
          />
        </WidgetGrid>
      </div>
    </AppLayout>
  );
}
