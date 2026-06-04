import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Toggle from '../index';

describe('Toggle', () => {
  it('renders with aria-checked=true when checked', () => {
    render(<Toggle checked={true} onChange={vi.fn()} label="Enable feature" />);
    expect(screen.getByRole('switch', { name: 'Enable feature' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  it('renders with aria-checked=false when unchecked', () => {
    render(<Toggle checked={false} onChange={vi.fn()} label="Enable feature" />);
    expect(screen.getByRole('switch', { name: 'Enable feature' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
  });

  it('calls onChange with toggled value when clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Enable feature" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('does not call onChange when disabled', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} disabled label="Enable feature" />);
    await user.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });
});
