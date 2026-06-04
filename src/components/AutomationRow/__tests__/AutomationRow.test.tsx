import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AutomationDto } from '@app/hooks/useAutomations';
import type { QueryFilters } from '@app/hooks/useSavedQueries';
import { describe, expect, it, vi } from 'vitest';
import { AutomationRow, StatusDot } from '../index';

const baseAutomation: AutomationDto = {
  id: 1,
  name: 'My Automation',
  query: { id: 10, name: 'Old Movies', filters: {} as QueryFilters },
  provider: { id: 2, name: 'Plex', type: 'plex' },
  taskId: 'delete',
  schedule: '0 2 * * *',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('StatusDot', () => {
  it('renders with bg-danger class for error status', () => {
    render(<StatusDot status="error" data-testid="dot" />);
    const dot = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot.className).toMatch(/bg-danger/);
  });
});

describe('AutomationRow', () => {
  it('renders automation name, query name, and taskId', () => {
    render(
      <AutomationRow
        automation={baseAutomation}
        onToggle={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.getByText('My Automation')).toBeInTheDocument();
    expect(screen.getByText('Old Movies')).toBeInTheDocument();
    expect(screen.getByText('delete')).toBeInTheDocument();
  });

  it('calls onToggle when the pause/resume button is clicked', async () => {
    const onToggle = vi.fn();
    render(
      <AutomationRow
        automation={baseAutomation}
        onToggle={onToggle}
        onDelete={vi.fn()}
      />
    );
    screen.getByTitle('Pause').click();
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('calls onDelete after confirming deletion', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <AutomationRow
        automation={baseAutomation}
        onToggle={vi.fn()}
        onDelete={onDelete}
      />
    );
    await user.click(screen.getByTitle('Delete automation'));
    await user.click(screen.getByText('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
