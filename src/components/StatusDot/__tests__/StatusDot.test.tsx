import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StatusDot from '../index';

describe('StatusDot', () => {
  it('renders a span element for active status', () => {
    const { container } = render(<StatusDot status="active" />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('renders a span element for paused status', () => {
    const { container } = render(<StatusDot status="paused" />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });

  it('renders a span element for error status', () => {
    const { container } = render(<StatusDot status="error" />);
    expect(container.querySelector('span')).toBeInTheDocument();
  });
});
