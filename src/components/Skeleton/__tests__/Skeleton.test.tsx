// src/components/Skeleton/__tests__/Skeleton.test.tsx
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Skeleton } from '../index';

describe('Skeleton', () => {
  it('renders correctly with default props', () => {
    render(<Skeleton />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toBeInTheDocument();
    expect(skeleton).toHaveClass('animate-pulse rounded-md bg-gray-200 dark:bg-gray-800');
  });

  it('applies additional className', () => {
    render(<Skeleton className="h-10 w-full" />);
    const skeleton = screen.getByTestId('skeleton');
    expect(skeleton).toHaveClass('h-10 w-full');
  });
});
