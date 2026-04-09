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
    fireEvent.error(img);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText(fallbackText)).toBeInTheDocument();
  });

  it('does not render a skeleton overlay — blur placeholder is handled by next/image', () => {
    render(<MediaPoster src="https://example.com/poster.jpg" alt="Poster" />);
    // Manual skeleton is removed; next/image blur placeholder handles the transition
    expect(screen.queryByTestId('skeleton')).not.toBeInTheDocument();
  });

  it('renders image with fill layout via next/image', () => {
    render(<MediaPoster src="https://example.com/poster.jpg" alt="Poster" />);
    const img = screen.getByRole('img', { name: 'Poster' });
    // The next/image mock applies position:absolute when fill is true
    expect(img).toHaveStyle({ position: 'absolute' });
  });

  it('passes placeholder="blur" and blurDataURL to next/image', () => {
    render(<MediaPoster src="https://example.com/poster.jpg" alt="Poster" />);
    const img = screen.getByRole('img', { name: 'Poster' });
    // The mock exposes these as data attributes so tests can assert them
    expect(img).toHaveAttribute('data-placeholder', 'blur');
    expect(img).toHaveAttribute('data-blur-url');
  });
});
