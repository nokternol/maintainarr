import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MediaPage from '../index';

describe('MediaPage', () => {
  it('renders the page title', () => {
    render(<MediaPage />);
    expect(screen.getByText(/managed media/i)).toBeInTheDocument();
  });

  it('renders AppLayout with sidebar', () => {
    const { container } = render(<MediaPage />);
    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('shows movie titles after loading', async () => {
    render(<MediaPage />);

    await waitFor(() => {
      expect(screen.getByText(/the matrix/i)).toBeInTheDocument();
    });
  });

  it('shows series titles after loading', async () => {
    render(<MediaPage />);

    await waitFor(() => {
      expect(screen.getByText(/breaking bad/i)).toBeInTheDocument();
    });
  });
});
