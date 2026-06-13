import { useRatings } from '@app/hooks/useRatings';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RatingsPanel from '../index';

vi.mock('@app/hooks/useRatings');

describe('RatingsPanel', () => {
  it('renders nothing when closed', () => {
    vi.mocked(useRatings).mockReturnValue({
      trigger: vi.fn(),
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    render(<RatingsPanel isOpen={false} onClose={() => {}} title="The Matrix" year={1999} />);
    // Dialog (and all visible panel content) must be absent when closed
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders title and year when open', () => {
    vi.mocked(useRatings).mockReturnValue({
      trigger: vi.fn(),
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    render(<RatingsPanel isOpen={true} onClose={() => {}} title="The Matrix" year={1999} />);
    expect(screen.getByText('The Matrix')).toBeInTheDocument();
    expect(screen.getByText(/1999/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    vi.mocked(useRatings).mockReturnValue({
      trigger: vi.fn(),
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    const onClose = vi.fn();
    render(<RatingsPanel isOpen={true} onClose={onClose} title="Breaking Bad" year={2008} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows ratings after loading', async () => {
    vi.mocked(useRatings).mockReturnValue({
      trigger: vi.fn(),
      data: undefined,
      error: undefined,
      isLoading: false,
    });
    render(<RatingsPanel isOpen={true} onClose={() => {}} title="Breaking Bad" year={2008} />);

    await waitFor(() => {
      // RatingsDisplay is present — title appears in multiple nodes (live region, panel h2, display h2)
      expect(screen.getAllByText(/breaking bad/i).length).toBeGreaterThan(0);
    });
  });

  it('renders Identity section with TMDB and IMDb IDs', () => {
    vi.mocked(useRatings).mockReturnValue({
      trigger: vi.fn(),
      data: {
        title: 'Test Movie',
        year: 2020,
        ids: {
          tmdbId: 123,
          imdbId: 'tt0111161',
          tvdbId: undefined,
          tvMazeId: undefined,
        },
        summary: {
          averageRating: 8.5,
          totalSources: 3,
          foundSources: 3,
        },
      } as unknown as ReturnType<typeof useRatings>['data'],
      error: undefined,
      isLoading: false,
    });

    render(<RatingsPanel isOpen={true} onClose={() => {}} title="Test Movie" year={2020} />);

    // Check for the Identity section
    expect(screen.getByText('Identity')).toBeInTheDocument();
    // Check for TMDB ID
    expect(screen.getByText('TMDB')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
    // Check for IMDb ID
    expect(screen.getByText('IMDb')).toBeInTheDocument();
    expect(screen.getByText('tt0111161')).toBeInTheDocument();
  });
});
