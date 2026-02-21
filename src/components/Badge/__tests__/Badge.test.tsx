import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from '../index';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Badge data-testid="badge">Default</Badge>);
    expect(screen.getByTestId('badge').className).toMatch(/default/);
  });

  it('applies success variant styles', () => {
    render(
      <Badge variant="success" data-testid="badge">
        Success
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/success/);
  });

  it('applies warning variant styles', () => {
    render(
      <Badge variant="warning" data-testid="badge">
        Warning
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/warning/);
  });

  it('applies error variant styles', () => {
    render(
      <Badge variant="error" data-testid="badge">
        Error
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/error/);
  });

  it('applies info variant styles', () => {
    render(
      <Badge variant="info" data-testid="badge">
        Info
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/info/);
  });

  it('applies teal variant styles', () => {
    render(
      <Badge variant="teal" data-testid="badge">
        Teal
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/teal/);
  });

  it('applies small size styles', () => {
    render(
      <Badge size="sm" data-testid="badge">
        Small
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/sm/);
  });

  it('applies medium size styles by default', () => {
    render(<Badge data-testid="badge">Medium</Badge>);
    expect(screen.getByTestId('badge').className).toMatch(/md/);
  });

  it('applies large size styles', () => {
    render(
      <Badge size="lg" data-testid="badge">
        Large
      </Badge>
    );
    expect(screen.getByTestId('badge').className).toMatch(/lg/);
  });

  it('accepts custom className', () => {
    const { container } = render(<Badge className="custom-class">Test</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(<Badge data-testid="custom-badge">Test</Badge>);
    expect(container.querySelector('[data-testid="custom-badge"]')).toBeInTheDocument();
  });

  it('renders as a span element', () => {
    const { container } = render(<Badge>Test</Badge>);
    expect(container.firstChild?.nodeName).toBe('SPAN');
  });
});
