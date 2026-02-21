import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../index';

describe('Skeleton', () => {
  it('renders correctly', () => {
    render(<Skeleton />);
    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Skeleton className="custom-skeleton" />);
    expect(screen.getByTestId('skeleton')).toHaveClass('custom-skeleton');
  });

  it('passes through HTML attributes', () => {
    render(<Skeleton aria-label="loading" />);
    expect(screen.getByTestId('skeleton')).toHaveAttribute('aria-label', 'loading');
  });
});
