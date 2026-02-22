import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RatingsForm from '../index';

describe('RatingsForm', () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
  });

  it('renders all form fields', () => {
    render(<RatingsForm onSubmit={mockOnSubmit} />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/year/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/tmdb api key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/omdb api key/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fetch ratings/i })).toBeInTheDocument();
  });

  it('submits form with all values', () => {
    render(<RatingsForm onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Breaking Bad' } });
    fireEvent.change(screen.getByLabelText(/year/i), { target: { value: '2008' } });
    fireEvent.change(screen.getByLabelText(/tmdb api key/i), { target: { value: 'tmdb-key' } });
    fireEvent.change(screen.getByLabelText(/omdb api key/i), { target: { value: 'omdb-key' } });

    fireEvent.click(screen.getByRole('button', { name: /fetch ratings/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      title: 'Breaking Bad',
      year: 2008,
      tmdbApiKey: 'tmdb-key',
      omdbApiKey: 'omdb-key',
    });
  });

  it('submits without optional year', () => {
    render(<RatingsForm onSubmit={mockOnSubmit} />);

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'The Matrix' } });
    fireEvent.click(screen.getByRole('button', { name: /fetch ratings/i }));

    expect(mockOnSubmit).toHaveBeenCalledWith({
      title: 'The Matrix',
      year: undefined,
      tmdbApiKey: '',
      omdbApiKey: '',
    });
  });

  it('disables button when loading', () => {
    render(<RatingsForm onSubmit={mockOnSubmit} isLoading />);

    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
  });

  it('shows helper text for API keys', () => {
    render(<RatingsForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText(/optional - uses existing tmdb config if empty/i)).toBeInTheDocument();
    expect(screen.getByText(/optional - get free key/i)).toBeInTheDocument();
  });

  it('shows info about tvmaze not needing a key', () => {
    render(<RatingsForm onSubmit={mockOnSubmit} />);

    expect(screen.getByText(/tvmaze: always included/i)).toBeInTheDocument();
  });
});
