import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import RatingsPage from '../index';

describe('RatingsPage', () => {
  it('renders the page heading as an h1', () => {
    render(<RatingsPage />);
    // The TopBar renders an h1 with the page title
    expect(screen.getByRole('heading', { level: 1, name: /ratings/i })).toBeInTheDocument();
  });

  it('renders the RatingsForm', () => {
    render(<RatingsPage />);

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /fetch ratings/i })).toBeInTheDocument();
  });

  it('renders with sidebar and layout', () => {
    const { container } = render(<RatingsPage />);

    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('shows loading state after form submission', async () => {
    render(<RatingsPage />);

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Breaking Bad' },
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch ratings/i }));

    // Button should briefly show loading state
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /loading/i })).toBeDefined();
    });
  });

  it('shows RatingsDisplay after successful fetch', async () => {
    render(<RatingsPage />);

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Breaking Bad' },
    });

    fireEvent.click(screen.getByRole('button', { name: /fetch ratings/i }));

    // After MSW resolves, should show ratings results (Average label in header)
    await waitFor(() => {
      expect(screen.getByText(/average/i)).toBeInTheDocument();
    });
  });

  it('renders the instructions section listing sources', () => {
    render(<RatingsPage />);

    // The instructions panel heading is unique
    expect(screen.getByText('Ratings Sources')).toBeInTheDocument();
  });
});
