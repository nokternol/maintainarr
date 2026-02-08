import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Badge from '../index';

describe('Badge', () => {
  it('renders children correctly', () => {
    render(<Badge>Test</Badge>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-slate-700/50');
    expect(badge).toHaveClass('text-slate-300');
  });

  it('applies success variant styles', () => {
    const { container } = render(<Badge variant="success">Success</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-emerald-500/10');
    expect(badge).toHaveClass('text-emerald-500');
  });

  it('applies warning variant styles', () => {
    const { container } = render(<Badge variant="warning">Warning</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-amber-500/10');
    expect(badge).toHaveClass('text-amber-500');
  });

  it('applies error variant styles', () => {
    const { container } = render(<Badge variant="error">Error</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-red-500/10');
    expect(badge).toHaveClass('text-red-500');
  });

  it('applies info variant styles', () => {
    const { container } = render(<Badge variant="info">Info</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-blue-500/10');
    expect(badge).toHaveClass('text-blue-500');
  });

  it('applies teal variant styles', () => {
    const { container } = render(<Badge variant="teal">Teal</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('bg-teal-500/10');
    expect(badge).toHaveClass('text-teal-400');
  });

  it('applies small size styles', () => {
    const { container } = render(<Badge size="sm">Small</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('px-2');
    expect(badge).toHaveClass('py-0.5');
    expect(badge).toHaveClass('text-xs');
  });

  it('applies medium size styles by default', () => {
    const { container } = render(<Badge>Medium</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('px-2.5');
    expect(badge).toHaveClass('py-1');
    expect(badge).toHaveClass('text-sm');
  });

  it('applies large size styles', () => {
    const { container } = render(<Badge size="lg">Large</Badge>);
    const badge = container.firstChild as HTMLElement;
    expect(badge).toHaveClass('px-3');
    expect(badge).toHaveClass('py-1.5');
    expect(badge).toHaveClass('text-base');
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
