import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ConnectionTestIcon from '../index';

describe('ConnectionTestIcon', () => {
  it('renders nothing when status is idle', () => {
    const { container } = render(<ConnectionTestIcon status="idle" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders an SVG when status is loading', () => {
    const { container } = render(<ConnectionTestIcon status="loading" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders an SVG when status is pass', () => {
    const { container } = render(<ConnectionTestIcon status="pass" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders an SVG when status is fail', () => {
    const { container } = render(<ConnectionTestIcon status="fail" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
