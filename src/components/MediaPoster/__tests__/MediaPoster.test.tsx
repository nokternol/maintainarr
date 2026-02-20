import '@testing-library/jest-dom/vitest';
import { fireEvent } from '@testing-library/react';
import { render, screen } from '@tests/helpers/component';
import { describe, expect, it } from 'vitest';
import { MediaPoster } from '../index';

describe('MediaPoster', () => {
  it('renders an image with correct src and alt', () => {
    const src = 'https://example.com/poster.jpg';
    const alt = 'Movie Poster';

    render(<MediaPoster src={src} alt={alt} />);

    const img = screen.getByRole('img', { name: alt });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', src);
  });

  it('renders fallback UI when src is missing', () => {
    const fallbackText = 'No Poster';
    render(<MediaPoster alt="Movie Poster" fallbackText={fallbackText} />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(fallbackText)).toBeInTheDocument();
  });

  it('renders fallback UI when the img fires an onError event (broken link)', async () => {
    const fallbackText = 'Broken Image';

    render(
      <MediaPoster
        src="https://example.com/broken.jpg"
        alt="Movie Poster"
        fallbackText={fallbackText}
      />
    );

    const img = screen.getByRole('img');

    // Fire React synthetic error event
    fireEvent.error(img);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(fallbackText)).toBeInTheDocument();
  });

  it('displays a loading skeleton state while the image is loading', async () => {
    render(<MediaPoster src="https://example.com/loading.jpg" alt="Poster" />);
    // It should render skeleton right away before onLoad
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();

    // Image should be present but possibly invisible/hidden to assistive tech or styled
    const img = screen.getByAltText('Poster');

    // Fire load event
    fireEvent.load(img);

    // After load, skeleton should be gone
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
    // Image should be fully visible and accessible
    expect(screen.getByRole('img', { name: 'Poster' })).toBeInTheDocument();
  });
});
