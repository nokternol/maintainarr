import '@testing-library/jest-dom/vitest';
import userEvent from '@testing-library/user-event';
import { render, screen } from '@tests/helpers/component';
import { describe, expect, it, vi } from 'vitest';
import { MediaCard } from '../index';

describe('MediaCard', () => {
  it('renders the title and passes poster attributes correctly', () => {
    const title = 'Inception';
    const posterUrl = 'https://example.com/inception.jpg';

    render(
      <MediaCard id="123">
        <MediaCard.Poster src={posterUrl} alt={title} />
        <MediaCard.Content>
          <MediaCard.Title>{title}</MediaCard.Title>
        </MediaCard.Content>
      </MediaCard>
    );

    // Check title rendering
    expect(screen.getByText(title)).toBeInTheDocument();

    // Check image (delegated to MediaPoster)
    const img = screen.getByRole('img', { name: title });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', posterUrl);
  });

  it('supports missing sub-components correctly', () => {
    render(
      <MediaCard id="cmp">
        <MediaCard.Content>
          <MediaCard.Title>Custom Composition</MediaCard.Title>
        </MediaCard.Content>
      </MediaCard>
    );
    expect(screen.getByText('Custom Composition')).toBeInTheDocument();
  });

  it('triggers onClick with the correct id when clicked or keyboard-activated', async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();

    render(
      <MediaCard id="456" onClick={onClick}>
        <MediaCard.Title>The Matrix</MediaCard.Title>
      </MediaCard>
    );

    const card = screen.getByTestId('media-card');

    // Test click
    await user.click(card);
    expect(onClick).toHaveBeenCalledWith('456');
    expect(onClick).toHaveBeenCalledTimes(1);

    // Test keyboard Enter
    card.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledWith('456');
    expect(onClick).toHaveBeenCalledTimes(2);

    // Test keyboard Space
    await user.keyboard(' ');
    expect(onClick).toHaveBeenCalledWith('456');
    expect(onClick).toHaveBeenCalledTimes(3);
  });

  it('displays the correct visual badge based on status', () => {
    const { rerender } = render(
      <MediaCard id="789">
        <MediaCard.Poster alt="Avatar" />
        <MediaCard.StatusBadge status="monitored" />
      </MediaCard>
    );
    expect(screen.getByText(/monitored/i)).toBeInTheDocument();

    rerender(
      <MediaCard id="789">
        <MediaCard.Poster alt="Avatar" />
        <MediaCard.StatusBadge status="missing" />
      </MediaCard>
    );
    expect(screen.getByText(/missing/i)).toBeInTheDocument();

    rerender(
      <MediaCard id="789">
        <MediaCard.Poster alt="Avatar" />
        <MediaCard.StatusBadge status="downloaded" />
      </MediaCard>
    );
    expect(screen.getByText(/downloaded/i)).toBeInTheDocument();
  });
});
