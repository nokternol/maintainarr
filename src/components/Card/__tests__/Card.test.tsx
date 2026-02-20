import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from '../index';

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Test content</Card>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-slate-900');
    expect(card).not.toHaveClass('border');
  });

  it('applies outlined variant styles', () => {
    const { container } = render(<Card variant="outlined">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('bg-slate-900');
    expect(card).toHaveClass('border');
    expect(card).toHaveClass('border-slate-700');
  });

  it('applies elevated variant styles', () => {
    const { container } = render(<Card variant="elevated">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('shadow-lg');
  });

  it('applies default padding', () => {
    const { container } = render(<Card>Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('p-4');
  });

  it('applies small padding', () => {
    const { container } = render(<Card padding="sm">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('p-3');
  });

  it('applies large padding', () => {
    const { container } = render(<Card padding="lg">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('p-6');
  });

  it('applies no padding when specified', () => {
    const { container } = render(<Card padding="none">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).not.toHaveClass('p-3');
    expect(card).not.toHaveClass('p-4');
    expect(card).not.toHaveClass('p-6');
  });

  it('renders header when provided', () => {
    render(<Card header={<h3>Header</h3>}>Content</Card>);
    expect(screen.getByText('Header')).toBeInTheDocument();
  });

  it('renders footer when provided', () => {
    render(<Card footer={<div>Footer</div>}>Content</Card>);
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('renders header and footer with border separators', () => {
    const { container } = render(
      <Card header={<h3>Header</h3>} footer={<div>Footer</div>}>
        Content
      </Card>
    );
    const borders = container.querySelectorAll('.border-slate-700');
    expect(borders.length).toBeGreaterThan(0);
  });

  it('accepts custom className', () => {
    const { container } = render(<Card className="custom-class">Content</Card>);
    const card = container.firstChild as HTMLElement;
    expect(card).toHaveClass('custom-class');
  });

  it('passes through HTML attributes', () => {
    const { container } = render(<Card data-testid="custom-card">Content</Card>);
    expect(container.querySelector('[data-testid="custom-card"]')).toBeInTheDocument();
  });
});
