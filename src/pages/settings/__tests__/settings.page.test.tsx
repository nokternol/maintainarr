import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import SettingsPage from '../index';

describe('SettingsPage', () => {
  it('renders the page title', () => {
    render(<SettingsPage />);
    expect(screen.getByText(/provider settings/i)).toBeInTheDocument();
  });

  it('renders an Add Provider button', () => {
    render(<SettingsPage />);
    expect(screen.getByRole('button', { name: /add provider/i })).toBeInTheDocument();
  });

  it('renders AppLayout with sidebar', () => {
    const { container } = render(<SettingsPage />);
    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('shows provider names after loading', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(screen.getByText(/radarr main/i)).toBeInTheDocument();
    });
  });
});
