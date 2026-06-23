import type { ProviderSummary } from '@app/hooks/useProviderSettings';
import type { ProviderTaskAvailability } from '@app/hooks/useProviderTasks';
import type { SavedQuery } from '@app/hooks/useSavedQueries';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../../../../tests/mocks/server';
import AutomationBuilder from '../index';

// Real hooks run against MSW so the test exercises the fetch + the join of
// instance-keyed task availability with provider settings — the derivation
// the builder now depends on.
const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

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

function mockApi(providers: ProviderSummary[], availability: ProviderTaskAvailability[]): void {
  server.use(
    http.get('/api/settings/providers', () => HttpResponse.json({ data: providers })),
    http.get('/api/providers/tasks', () => HttpResponse.json({ data: availability }))
  );
}

const ENABLED_UNMONITOR = {
  id: 'unmonitorMovie',
  label: 'Unmonitor movie',
  destructive: false,
  enabled: true,
};
const DISABLED_DELETE = {
  id: 'deleteMovieWithFiles',
  label: 'Delete movie + files',
  destructive: true,
  enabled: false,
};
const ENABLED_DELETE = { ...DISABLED_DELETE, enabled: true };

const mockQuery: SavedQuery = {
  id: 1,
  name: 'Old Movies',
  contentType: 'movie',
  filterValues: [{ key: 'yearMax', value: 2015 }],
  health: { status: 'healthy', providerStatus: [] },
  createdAt: '2024-01-01T00:00:00Z',
};

function renderBuilder(props: Partial<React.ComponentProps<typeof AutomationBuilder>> = {}) {
  return render(
    <AutomationBuilder
      queries={[mockQuery]}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
      isSubmitting={false}
      {...props}
    />,
    { wrapper }
  );
}

describe('AutomationBuilder', () => {
  it('renders the New automation heading', () => {
    mockApi([makeProvider()], [{ providerId: 1, type: 'RADARR', tasks: [ENABLED_UNMONITOR] }]);
    renderBuilder();
    expect(screen.getByText('New automation')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    mockApi([makeProvider()], [{ providerId: 1, type: 'RADARR', tasks: [ENABLED_UNMONITOR] }]);
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderBuilder({ onCancel });
    await user.click(screen.getAllByRole('button', { name: /cancel/i })[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('offers only enabled tasks, hiding ones disabled on the instance', async () => {
    mockApi(
      [makeProvider()],
      [{ providerId: 1, type: 'RADARR', tasks: [ENABLED_UNMONITOR, DISABLED_DELETE] }]
    );
    renderBuilder();
    expect(await screen.findByRole('radio', { name: /unmonitor movie/i })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /delete movie \+ files/i })).not.toBeInTheDocument();
  });

  it('groups tasks per instance — two instances of the same type appear separately', async () => {
    mockApi(
      [makeProvider({ id: 1, name: 'Radarr 4K' }), makeProvider({ id: 2, name: 'Radarr 1080p' })],
      [
        { providerId: 1, type: 'RADARR', tasks: [ENABLED_UNMONITOR] },
        { providerId: 2, type: 'RADARR', tasks: [ENABLED_UNMONITOR] },
      ]
    );
    renderBuilder();
    expect(await screen.findByText('Radarr 4K')).toBeInTheDocument();
    expect(screen.getByText('Radarr 1080p')).toBeInTheDocument();
    expect(screen.getAllByRole('radio', { name: /unmonitor movie/i })).toHaveLength(2);
  });

  it('does not offer tasks for an inactive provider instance', async () => {
    mockApi(
      [makeProvider({ isActive: false })],
      [{ providerId: 1, type: 'RADARR', tasks: [ENABLED_UNMONITOR] }]
    );
    renderBuilder();
    expect(await screen.findByText(/no enabled tasks found/i)).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: /unmonitor movie/i })).not.toBeInTheDocument();
  });

  it('marks an enabled destructive task with a warning', async () => {
    mockApi([makeProvider()], [{ providerId: 1, type: 'RADARR', tasks: [ENABLED_DELETE] }]);
    renderBuilder();
    expect(
      await screen.findByRole('radio', { name: /delete movie \+ files/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Destructive action')).toBeInTheDocument();
  });

  it('shows the empty state with a Settings link when no enabled tasks exist', async () => {
    mockApi([makeProvider()], [{ providerId: 1, type: 'RADARR', tasks: [DISABLED_DELETE] }]);
    renderBuilder();
    expect(await screen.findByText(/no enabled tasks found/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /settings/i })).toHaveAttribute('href', '/settings');
  });

  it('calls onSubmit with the selected instance providerId and taskId', async () => {
    mockApi([makeProvider()], [{ providerId: 1, type: 'RADARR', tasks: [ENABLED_UNMONITOR] }]);
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    renderBuilder({ onSubmit });

    await user.type(screen.getByLabelText('Name'), 'My Automation');
    await user.click(await screen.findByRole('radio', { name: /unmonitor movie/i }));
    await user.click(screen.getByRole('button', { name: /create automation/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Automation',
        querySources: expect.arrayContaining([
          expect.objectContaining({ queryId: 1, role: 'include' }),
        ]),
        taskId: 'unmonitorMovie',
        providerId: 1,
      })
    );
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('queryId');
  });
});
