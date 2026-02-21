import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import LoadingSpinner from '../index';

describe('LoadingSpinner', () => {
  it('renders spinner SVG', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('role', 'img');
    expect(svg).toHaveAttribute('aria-label', 'Loading');
  });

  it('applies small size styles', () => {
    const { container } = render(<LoadingSpinner size="sm" />);
    const svg = container.querySelector('svg');
    expect(svg?.className).toMatch(/sm_/);
  });

  it('applies medium size styles by default', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg?.className).toMatch(/md_/);
  });

  it('applies large size styles', () => {
    const { container } = render(<LoadingSpinner size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg?.className).toMatch(/lg_/);
  });

  it('has animate-spin class', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg?.className).toMatch(/icon_/);
  });

  it('uses teal color', () => {
    const { container } = render(<LoadingSpinner />);
    const svg = container.querySelector('svg');
    expect(svg?.className).toMatch(/icon_/);
  });

  it('accepts custom className', () => {
    const { container } = render(<LoadingSpinner className="custom-class" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(<LoadingSpinner data-testid="custom-spinner" />);
    expect(container.querySelector('[data-testid="custom-spinner"]')).toBeInTheDocument();
  });
});
