import StatusDot from '@app/components/StatusDot';
import type { AutomationDto } from '@app/hooks/useAutomations';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AutomationRow from '../index';

const mockAutomation: AutomationDto = {
  id: 1,
  name: 'Archive old movies',
  query: {
    id: 1,
    name: 'Stale Movies',
    contentType: 'movie',
  },
  provider: { id: 1, name: 'Radarr', type: 'RADARR' },
  taskId: 'deleteMovieWithFiles',
  schedule: '0 2 * * *',
  status: 'active',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('StatusDot', () => {
  it('renders with bg-danger class for error status', () => {
    render(<StatusDot status="error" />);
    const dot = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(dot.className).toMatch(/bg-danger/);
  });
});

describe('AutomationRow', () => {
  it('renders the automation name', () => {
    render(<AutomationRow automation={mockAutomation} onToggle={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Archive old movies')).toBeInTheDocument();
  });

  it('calls onToggle when the pause/resume button is clicked', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<AutomationRow automation={mockAutomation} onToggle={onToggle} onDelete={vi.fn()} />);
    await user.click(screen.getByTitle('Pause'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation before calling onDelete', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(<AutomationRow automation={mockAutomation} onToggle={vi.fn()} onDelete={onDelete} />);
    await user.click(screen.getByTitle('Delete automation'));
    // Confirmation shown — click confirm
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
