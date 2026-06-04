import type { SavedQuery } from '@app/hooks/useSavedQueries';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AutomationBuilder from '../index';

vi.mock('@app/hooks/useProviderSettings', () => ({
  useProviderSettings: () => ({
    providers: [
      {
        id: 1,
        type: 'RADARR',
        name: 'Radarr Main',
        url: 'http://localhost:7878/api/v3',
        apiKey: '***',
        settings: { enabledTasks: ['unmonitorMovie'] },
        isActive: true,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    ],
  }),
}));

import type { QueryFilters } from '@app/hooks/useSavedQueries';

const mockQuery: SavedQuery = {
  id: 1,
  name: 'Old Movies',
  filters: { yearMax: 2015 } as QueryFilters,
  createdAt: '2024-01-01T00:00:00Z',
};

describe('AutomationBuilder', () => {
  it('renders the New automation heading', () => {
    render(
      <AutomationBuilder
        queries={[mockQuery]}
        onSubmit={vi.fn()}
        onCancel={vi.fn()}
        isSubmitting={false}
      />
    );
    expect(screen.getByText('New automation')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <AutomationBuilder
        queries={[mockQuery]}
        onSubmit={vi.fn()}
        onCancel={onCancel}
        isSubmitting={false}
      />
    );
    // Header cancel button
    await user.click(screen.getAllByRole('button', { name: /cancel/i })[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onSubmit with correct payload when form is filled and submitted', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <AutomationBuilder
        queries={[mockQuery]}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
        isSubmitting={false}
      />
    );

    // Fill name
    await user.type(screen.getByLabelText('Name'), 'My Automation');

    // Query is pre-selected (only one query)
    // Select the available task
    await user.click(screen.getByRole('radio', { name: /unmonitor movie/i }));

    // Submit
    await user.click(screen.getByRole('button', { name: /create automation/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'My Automation',
        queryId: 1,
        taskId: 'unmonitorMovie',
        providerId: 1,
      })
    );
  });
});
