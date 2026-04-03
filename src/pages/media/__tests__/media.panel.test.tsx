import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MediaPage from '../index';

describe('MediaPage — ratings panel', () => {
  it('opens ratings panel when a movie card is clicked', async () => {
    render(<MediaPage />);

    // Wait for movies to load
    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument();
    });

    // Click the movie card
    const card = screen.getByTestId('media-card-movie-1');
    fireEvent.click(card);

    // Panel should open with the movie title
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getAllByText('The Matrix').length).toBeGreaterThan(0);
  });

  it('closes ratings panel when close is clicked', async () => {
    render(<MediaPage />);

    await waitFor(() => {
      expect(screen.getByText('The Matrix')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('media-card-movie-1'));

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });
});
