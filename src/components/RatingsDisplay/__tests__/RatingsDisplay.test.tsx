import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RatingsDisplay from '../index';

const mockRatings = {
  title: 'Breaking Bad',
  year: 2008,
  tmdb: {
    source: 'tmdb' as const,
    tvRating: 8.9,
    tvVotes: 5234,
    popularity: 123.45,
    found: true,
  },
  omdb: {
    source: 'omdb' as const,
    imdbRating: 9.5,
    imdbVotes: 1823456,
    rottenTomatoesRating: 96,
    metacriticRating: 99,
    found: true,
  },
  tvmaze: {
    source: 'tvmaze' as const,
    rating: 9.1,
    found: true,
  },
  summary: {
    averageRating: 9.17,
    totalSources: 3,
    foundSources: 3,
  },
};

describe('RatingsDisplay', () => {
  it('renders the show title and year', () => {
    render(<RatingsDisplay ratings={mockRatings} />);

    expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    expect(screen.getByText(/2008/)).toBeInTheDocument();
  });

  it('shows the average rating prominently', () => {
    render(<RatingsDisplay ratings={mockRatings} />);

    expect(screen.getByText(/9\.17/)).toBeInTheDocument();
    expect(screen.getByText(/average/i)).toBeInTheDocument();
  });

  it('shows TMDB source rating', () => {
    render(<RatingsDisplay ratings={mockRatings} />);

    expect(screen.getByText(/tmdb/i)).toBeInTheDocument();
    expect(screen.getByText(/8\.9/)).toBeInTheDocument();
  });

  it('shows OMDB source ratings including IMDb and Rotten Tomatoes', () => {
    render(<RatingsDisplay ratings={mockRatings} />);

    expect(screen.getByText(/omdb/i)).toBeInTheDocument();
    expect(screen.getByText(/9\.5/)).toBeInTheDocument();
    expect(screen.getByText(/96/)).toBeInTheDocument();
  });

  it('shows TVMaze source rating', () => {
    render(<RatingsDisplay ratings={mockRatings} />);

    expect(screen.getByText(/tvmaze/i)).toBeInTheDocument();
    // 9.1 is substring of 9.17, so check that at least one element has exactly "9.1"
    const elements = screen.getAllByText(/9\.1/);
    expect(elements.some((el) => el.textContent?.trim() === '9.1')).toBe(true);
  });

  it('shows total vs found sources count', () => {
    render(<RatingsDisplay ratings={mockRatings} />);

    // "3 of 3 sources" or similar
    expect(screen.getByText(/3.*source/i)).toBeInTheDocument();
  });

  it('handles source with found=false gracefully', () => {
    const partialRatings = {
      ...mockRatings,
      omdb: {
        source: 'omdb' as const,
        imdbRating: undefined,
        imdbVotes: undefined,
        rottenTomatoesRating: undefined,
        metacriticRating: undefined,
        found: false,
      },
      summary: {
        averageRating: 9.0,
        totalSources: 3,
        foundSources: 2,
      },
    };

    render(<RatingsDisplay ratings={partialRatings} />);

    expect(screen.getByText(/not found/i)).toBeInTheDocument();
  });

  it('renders nothing when ratings is null', () => {
    const { container } = render(<RatingsDisplay ratings={null} />);

    expect(container.firstChild).toBeNull();
  });
});
