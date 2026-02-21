import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ProviderPanel from '../index';

describe('ProviderPanel', () => {
  const mockOnFetch = vi.fn();

  const defaultProps = {
    title: 'Sonarr',
    type: 'SONARR' as const,
    onFetch: mockOnFetch,
  };

  beforeEach(() => {
    mockOnFetch.mockClear();
  });

  it('renders title correctly', () => {
    render(<ProviderPanel {...defaultProps} />);
    expect(screen.getByText('Sonarr')).toBeInTheDocument();
  });

  it('renders form inputs with correct labels', () => {
    render(<ProviderPanel {...defaultProps} />);
    expect(screen.getByLabelText(/URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
  });

  it('renders fetch button', () => {
    render(<ProviderPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /fetch metadata/i })).toBeInTheDocument();
  });

  it('calls onFetch with correct params when form is submitted', async () => {
    render(<ProviderPanel {...defaultProps} />);

    const urlInput = screen.getByLabelText(/URL/i);
    const apiKeyInput = screen.getByLabelText(/API Key/i);
    const button = screen.getByRole('button', { name: /fetch metadata/i });

    fireEvent.change(urlInput, { target: { value: 'http://localhost:8989' } });
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnFetch).toHaveBeenCalledWith({
        type: 'SONARR',
        url: 'http://localhost:8989',
        apiKey: 'test-key',
      });
    });
  });

  it('renders loading state when isLoading is true', () => {
    render(<ProviderPanel {...defaultProps} isLoading />);
    // Check for the loading div specifically (not the button text)
    const loadingDivs = screen.getAllByText(/loading/i);
    expect(loadingDivs.length).toBeGreaterThan(0);
  });

  it('renders error message when error prop is provided', () => {
    render(<ProviderPanel {...defaultProps} error="Failed to fetch" />);
    expect(screen.getByText(/failed to fetch/i)).toBeInTheDocument();
  });

  it('renders data sections when data is provided', () => {
    const data = {
      series: [{ id: 1, title: 'Breaking Bad', status: 'ended' }],
      qualityProfiles: [{ id: 1, name: 'HD-1080p' }],
      rootFolders: [{ id: 1, path: '/tv' }],
      tags: [{ id: 1, label: 'drama' }],
    };

    render(<ProviderPanel {...defaultProps} data={data} />);

    expect(screen.getByText(/series/i)).toBeInTheDocument();
    expect(screen.getByText(/qualityProfiles/i)).toBeInTheDocument();
    expect(screen.getByText(/rootFolders/i)).toBeInTheDocument();
    expect(screen.getByText(/tags/i)).toBeInTheDocument();
  });

  it('renders settings textarea for Jellyfin', () => {
    render(<ProviderPanel {...defaultProps} type="JELLYFIN" title="Jellyfin" />);
    expect(screen.getByLabelText(/settings/i)).toBeInTheDocument();
  });

  it('includes settings in onFetch payload for Jellyfin', async () => {
    render(<ProviderPanel {...defaultProps} type="JELLYFIN" title="Jellyfin" />);

    const urlInput = screen.getByLabelText(/URL/i);
    const apiKeyInput = screen.getByLabelText(/API Key/i);
    const settingsInput = screen.getByLabelText(/settings/i);
    const button = screen.getByRole('button', { name: /fetch metadata/i });

    fireEvent.change(urlInput, { target: { value: 'http://localhost:8096' } });
    fireEvent.change(apiKeyInput, { target: { value: 'test-key' } });
    fireEvent.change(settingsInput, { target: { value: '{"userId":"abc123"}' } });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockOnFetch).toHaveBeenCalledWith({
        type: 'JELLYFIN',
        url: 'http://localhost:8096',
        apiKey: 'test-key',
        settings: '{"userId":"abc123"}',
      });
    });
  });
});
