import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@tests/helpers/component';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ImageFader } from '../index';

const IMAGES = [
  'https://example.com/img1.jpg',
  'https://example.com/img2.jpg',
  'https://example.com/img3.jpg',
];

afterEach(() => {
  vi.useRealTimers();
});

describe('ImageFader — rendering', () => {
  it('returns null when images is empty', () => {
    const { container } = render(<ImageFader images={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an img for each provided URL', () => {
    const { container } = render(<ImageFader images={IMAGES} />);
    // next/image renders decorative imgs (alt="") which have no accessible role
    const imgs = container.querySelectorAll('img');
    expect(imgs).toHaveLength(IMAGES.length);
  });

  it('first image is visible on initial render', () => {
    const { container } = render(<ImageFader images={IMAGES} />);
    const slides = container.querySelectorAll('[aria-hidden]');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[2]).toHaveAttribute('aria-hidden', 'true');
  });

  it('applies the provided className to the wrapper', () => {
    const { container } = render(<ImageFader images={IMAGES} className="my-class" />);
    expect(container.firstChild).toHaveClass('my-class');
  });
});

describe('ImageFader — rotation', () => {
  it('advances to the second image after one rotation interval', () => {
    vi.useFakeTimers();
    const { container } = render(<ImageFader images={IMAGES} rotationSpeed={2000} />);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    const slides = container.querySelectorAll('[aria-hidden]');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'true');
    expect(slides[1]).toHaveAttribute('aria-hidden', 'false');
  });

  it('cycles back to the first image after all images have been shown', () => {
    vi.useFakeTimers();
    const { container } = render(<ImageFader images={IMAGES} rotationSpeed={1000} />);

    act(() => {
      vi.advanceTimersByTime(3000);
    });

    const slides = container.querySelectorAll('[aria-hidden]');
    expect(slides[0]).toHaveAttribute('aria-hidden', 'false');
  });

  it('does not rotate when images is empty', () => {
    vi.useFakeTimers();
    const { container } = render(<ImageFader images={[]} rotationSpeed={1000} />);

    act(() => {
      vi.advanceTimersByTime(10000);
    });

    expect(container.firstChild).toBeNull();
  });

  it('uses the default rotation speed of 6000ms', () => {
    vi.useFakeTimers();
    const { container } = render(<ImageFader images={IMAGES} />);

    act(() => {
      vi.advanceTimersByTime(5999);
    });
    const slidesBefore = container.querySelectorAll('[aria-hidden]');
    expect(slidesBefore[0]).toHaveAttribute('aria-hidden', 'false');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    const slidesAfter = container.querySelectorAll('[aria-hidden]');
    expect(slidesAfter[1]).toHaveAttribute('aria-hidden', 'false');
  });
});
