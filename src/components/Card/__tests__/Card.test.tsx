import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Card from '../index';

describe('Card', () => {
  it('renders children correctly', () => {
    render(<Card>Test content</Card>);
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('applies default variant styles', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card').className).toMatch(/default/);
  });

  it('applies outlined variant styles', () => {
    render(
      <Card variant="outlined" data-testid="card">
        Content
      </Card>
    );
    expect(screen.getByTestId('card').className).toMatch(/outlined/);
  });

  it('applies elevated variant styles', () => {
    render(
      <Card variant="elevated" data-testid="card">
        Content
      </Card>
    );
    expect(screen.getByTestId('card').className).toMatch(/elevated/);
  });

  it('applies default padding', () => {
    render(<Card data-testid="card">Content</Card>);
    expect(screen.getByTestId('card').className).toMatch(/padding_md/);
  });

  it('applies small padding', () => {
    render(
      <Card padding="sm" data-testid="card">
        Content
      </Card>
    );
    expect(screen.getByTestId('card').className).toMatch(/padding_sm/);
  });

  it('applies large padding', () => {
    render(
      <Card padding="lg" data-testid="card">
        Content
      </Card>
    );
    expect(screen.getByTestId('card').className).toMatch(/padding_lg/);
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
      <Card header="Header" footer="Footer" data-testid="card">
        Content
      </Card>
    );

    // First child is header, it should have header class
    expect(container.firstChild?.childNodes[0]).toHaveProperty(
      'className',
      expect.stringMatching(/header/)
    );

    // Last child is footer, it should have footer class
    expect(container.firstChild?.childNodes[2]).toHaveProperty(
      'className',
      expect.stringMatching(/footer/)
    );
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
