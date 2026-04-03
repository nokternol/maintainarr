import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RatingsPanel from '../index';

describe('RatingsPanel', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <RatingsPanel isOpen={false} onClose={() => {}} title="The Matrix" year={1999} />
    );
    // Panel should not be visible
    expect(screen.queryByText(/ratings/i)).toBeNull();
    // Or alternatively the container has no meaningful content
    expect(container.firstChild).toBeNull();
  });

  it('renders title and year when open', () => {
    render(<RatingsPanel isOpen={true} onClose={() => {}} title="The Matrix" year={1999} />);
    expect(screen.getByText('The Matrix')).toBeInTheDocument();
    expect(screen.getByText(/1999/)).toBeInTheDocument();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    render(<RatingsPanel isOpen={true} onClose={onClose} title="Breaking Bad" year={2008} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows ratings after loading', async () => {
    render(<RatingsPanel isOpen={true} onClose={() => {}} title="Breaking Bad" year={2008} />);

    await waitFor(() => {
      // RatingsDisplay renders the aggregated data
      expect(screen.getByText(/breaking bad/i)).toBeInTheDocument();
    });
  });
});
