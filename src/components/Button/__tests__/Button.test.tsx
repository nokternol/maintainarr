import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Button from '../index';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button data-testid="button">Primary</Button>);
    expect(screen.getByTestId('button').className).toMatch(/primary/);
  });

  it('applies secondary variant styles', () => {
    render(
      <Button variant="secondary" data-testid="button">
        Secondary
      </Button>
    );
    expect(screen.getByTestId('button').className).toMatch(/secondary/);
  });

  it('applies danger variant styles', () => {
    render(
      <Button variant="danger" data-testid="button">
        Danger
      </Button>
    );
    expect(screen.getByTestId('button').className).toMatch(/danger/);
  });

  it('applies size styles correctly', () => {
    const { rerender } = render(
      <Button size="sm" data-testid="button">
        Small
      </Button>
    );
    expect(screen.getByTestId('button').className).toMatch(/sm/);

    rerender(
      <Button size="md" data-testid="button">
        Medium
      </Button>
    );
    expect(screen.getByTestId('button').className).toMatch(/md/);

    rerender(
      <Button size="lg" data-testid="button">
        Large
      </Button>
    );
    expect(screen.getByTestId('button').className).toMatch(/lg/);
  });

  it('handles click events', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(<Button onClick={handleClick}>Click me</Button>);

    await user.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button loading>Submit</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('does not trigger onClick when loading', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    render(
      <Button loading onClick={handleClick}>
        Submit
      </Button>
    );

    await user.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });
});
