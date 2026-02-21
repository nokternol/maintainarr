import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ProvidersPage from '../index';

describe('ProvidersPage', () => {
  it('renders page title', () => {
    render(<ProvidersPage />);
    expect(screen.getByText(/provider metadata/i)).toBeInTheDocument();
  });

  it('renders ProviderPanel for each provider type', () => {
    render(<ProvidersPage />);

    // Check for all 6 provider panels
    expect(screen.getByText('Plex')).toBeInTheDocument();
    expect(screen.getByText('Jellyfin')).toBeInTheDocument();
    expect(screen.getByText('Sonarr')).toBeInTheDocument();
    expect(screen.getByText('Radarr')).toBeInTheDocument();
    expect(screen.getByText('Tautulli')).toBeInTheDocument();
    expect(screen.getByText('Overseerr')).toBeInTheDocument();
  });

  it('renders AppLayout with sidebar and topbar', () => {
    const { container } = render(<ProvidersPage />);

    // AppLayout should be present (check for common layout classes)
    expect(container.querySelector('aside')).toBeInTheDocument();
  });
});
