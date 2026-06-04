import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ProviderCard from '../index';
import type { ProviderSummary } from '@app/hooks/useProviderSettings';

const mockProvider: ProviderSummary = {
  id: 1,
  type: 'RADARR',
  name: 'Radarr Main',
  url: 'http://localhost:7878/api/v3',
  apiKey: '***',
  settings: null,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('ProviderCard', () => {
  it('renders the provider name', () => {
    render(<ProviderCard provider={mockProvider} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByText('Radarr Main')).toBeInTheDocument();
  });

  it('is collapsed by default (no connection details visible)', () => {
    render(<ProviderCard provider={mockProvider} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText('API key configured')).not.toBeInTheDocument();
  });

  it('expands to show connection details when header is clicked', async () => {
    const user = userEvent.setup();
    render(<ProviderCard provider={mockProvider} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /radarr main/i }));
    expect(screen.getByText('API key configured')).toBeInTheDocument();
  });
});
