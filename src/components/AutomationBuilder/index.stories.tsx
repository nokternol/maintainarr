import type { MediaQueryRecord } from '@app/hooks/useMediaQueries';
import type { ProviderSummary } from '@app/hooks/useProviderSettings';
import type { ProviderTaskAvailability } from '@app/hooks/useProviderTasks';
import type { Story } from '@ladle/react';
import { SWRConfig } from 'swr';
import AutomationBuilder from './index';

// Stories drive the real hooks from a preloaded SWR cache (no network): the
// keys match `useProviderSettings` and `useProviderTasks`, so each state is
// deterministic for the visual pass.
function makeProvider(overrides: Partial<ProviderSummary> = {}): ProviderSummary {
  return {
    id: 1,
    type: 'RADARR',
    name: 'Radarr Main',
    url: 'http://localhost:7878/api/v3',
    apiKey: '***',
    settings: null,
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

const queries: MediaQueryRecord[] = [
  {
    id: 1,
    name: 'Old Movies',
    contentType: 'movie',
    filterValues: [{ key: 'yearMax', value: 2015 }],
    health: { status: 'healthy', providerStatus: [], qualificationIssues: [] },
    createdAt: '2024-01-01T00:00:00Z',
  },
];

function withData(
  providers: ProviderSummary[],
  availability: ProviderTaskAvailability[],
  taskOptions: Record<string, Array<{ providerId: number; type: string; options: unknown[] }>> = {}
): React.ReactNode {
  const optionsFallback = Object.fromEntries(
    Object.entries(taskOptions).map(([route, data]) => [
      `/api/providers/task-options/${route}`,
      data,
    ])
  );
  return (
    <SWRConfig
      value={{
        provider: () => new Map(),
        fallback: {
          '/api/settings/providers': providers,
          '/api/providers/tasks': availability,
          ...optionsFallback,
        },
        revalidateOnMount: false,
        revalidateOnFocus: false,
        revalidateIfStale: false,
      }}
    >
      <div className="max-w-2xl p-6">
        <AutomationBuilder
          queries={queries}
          onSubmit={() => {}}
          onCancel={() => {}}
          isSubmitting={false}
        />
      </div>
    </SWRConfig>
  );
}

export const Populated: Story = () =>
  withData(
    [
      makeProvider({ id: 1, name: 'Radarr Main' }),
      makeProvider({ id: 2, type: 'SONARR', name: 'Sonarr Main' }),
    ],
    [
      {
        providerId: 1,
        type: 'RADARR',
        tasks: [
          { id: 'unmonitorMovie', label: 'Unmonitor movie', destructive: false, enabled: true },
          {
            id: 'triggerSearch',
            label: 'Trigger download search',
            destructive: false,
            enabled: true,
          },
          {
            id: 'deleteMovieWithFiles',
            label: 'Delete movie + files',
            destructive: true,
            enabled: true,
          },
        ],
      },
      {
        providerId: 2,
        type: 'SONARR',
        tasks: [
          { id: 'unmonitorSeries', label: 'Unmonitor series', destructive: false, enabled: true },
        ],
      },
    ]
  );

export const MultipleInstances: Story = () =>
  withData(
    [makeProvider({ id: 1, name: 'Radarr 4K' }), makeProvider({ id: 2, name: 'Radarr 1080p' })],
    [
      {
        providerId: 1,
        type: 'RADARR',
        tasks: [
          { id: 'unmonitorMovie', label: 'Unmonitor movie', destructive: false, enabled: true },
        ],
      },
      {
        providerId: 2,
        type: 'RADARR',
        tasks: [
          {
            id: 'deleteMovieWithFiles',
            label: 'Delete movie + files',
            destructive: true,
            enabled: true,
          },
        ],
      },
    ]
  );

export const ParameterizedTask: Story = () =>
  withData(
    [makeProvider({ id: 1, name: 'Radarr Main' })],
    [
      {
        providerId: 1,
        type: 'RADARR',
        tasks: [
          {
            id: 'changeQualityProfile',
            label: 'Change quality profile',
            destructive: false,
            enabled: true,
            parameter: {
              type: 'select',
              label: 'Quality profile',
              optionsRoute: 'quality-profiles',
            },
          },
        ],
      },
    ],
    {
      'quality-profiles': [
        {
          providerId: 1,
          type: 'RADARR',
          options: [
            { id: '1', label: 'HD-1080p' },
            { id: '2', label: 'Any' },
          ],
        },
      ],
    }
  );

export const Empty: Story = () =>
  withData(
    [makeProvider()],
    [
      {
        providerId: 1,
        type: 'RADARR',
        tasks: [
          {
            id: 'deleteMovieWithFiles',
            label: 'Delete movie + files',
            destructive: true,
            enabled: false,
          },
        ],
      },
    ]
  );
