import '@testing-library/jest-dom/vitest';
import { render, screen, setupUser } from '@tests/helpers/component';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OptionFilter } from '../index';

const BINARY_OPTIONS = [
  { value: 'true' as const, label: 'Downloaded' },
  { value: 'false' as const, label: 'Missing' },
];

const THREE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'anime', label: 'Anime' },
  { value: 'daily', label: 'Daily' },
];

// ─── Controlled wrapper for interaction tests ──────────────────────────────────

function Controlled<T extends string>({
  options,
  initial,
  variant,
}: {
  options: Array<{ value: T; label: string }>;
  initial?: T;
  variant?: 'segment' | 'chips';
}) {
  const [value, setValue] = useState<T | undefined>(initial);
  return <OptionFilter options={options} value={value} onChange={setValue} variant={variant} />;
}

// ─── Segment variant ──────────────────────────────────────────────────────────

describe('OptionFilter segment — rendering', () => {
  it('renders all option buttons', () => {
    render(<OptionFilter options={BINARY_OPTIONS} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /missing/i })).toBeInTheDocument();
  });

  it('renders an optional label before the options', () => {
    render(
      <OptionFilter label="Movies" options={BINARY_OPTIONS} value={undefined} onChange={vi.fn()} />
    );
    expect(screen.getByText('Movies')).toBeInTheDocument();
  });

  it('marks the active option with aria-pressed=true', () => {
    render(<OptionFilter options={BINARY_OPTIONS} value="true" onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /downloaded/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /missing/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });

  it('marks all options as not pressed when value is undefined', () => {
    render(<OptionFilter options={BINARY_OPTIONS} value={undefined} onChange={vi.fn()} />);
    for (const btn of screen.getAllByRole('button')) {
      expect(btn).toHaveAttribute('aria-pressed', 'false');
    }
  });

  it('renders three options correctly', () => {
    render(<OptionFilter options={THREE_OPTIONS} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: /standard/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /anime/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /daily/i })).toBeInTheDocument();
  });
});

describe('OptionFilter segment — interactions', () => {
  it('calls onChange with the option value when an unselected option is clicked', async () => {
    const onChange = vi.fn();
    const user = setupUser();
    render(<OptionFilter options={BINARY_OPTIONS} value={undefined} onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(onChange).toHaveBeenCalledWith('true');
  });

  it('calls onChange with undefined when the active option is clicked again', async () => {
    const onChange = vi.fn();
    const user = setupUser();
    render(<OptionFilter options={BINARY_OPTIONS} value="true" onChange={onChange} />);
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('toggles selection correctly through controlled state', async () => {
    const user = setupUser();
    render(<Controlled options={BINARY_OPTIONS} />);

    const btn = screen.getByRole('button', { name: /downloaded/i });
    expect(btn).toHaveAttribute('aria-pressed', 'false');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');

    await user.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
  });

  it('switches selection between options', async () => {
    const user = setupUser();
    render(<Controlled options={BINARY_OPTIONS} initial="true" />);

    await user.click(screen.getByRole('button', { name: /missing/i }));

    expect(screen.getByRole('button', { name: /downloaded/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByRole('button', { name: /missing/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });
});

// ─── Chips variant ────────────────────────────────────────────────────────────

describe('OptionFilter chips — rendering', () => {
  it('renders all chip buttons', () => {
    render(
      <OptionFilter options={BINARY_OPTIONS} value={undefined} onChange={vi.fn()} variant="chips" />
    );
    expect(screen.getByRole('button', { name: /downloaded/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /missing/i })).toBeInTheDocument();
  });

  it('marks the active chip with aria-pressed=true', () => {
    render(
      <OptionFilter options={BINARY_OPTIONS} value="false" onChange={vi.fn()} variant="chips" />
    );
    expect(screen.getByRole('button', { name: /missing/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByRole('button', { name: /downloaded/i })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
  });
});

describe('OptionFilter chips — interactions', () => {
  it('calls onChange with the option value on click', async () => {
    const onChange = vi.fn();
    const user = setupUser();
    render(
      <OptionFilter
        options={BINARY_OPTIONS}
        value={undefined}
        onChange={onChange}
        variant="chips"
      />
    );
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(onChange).toHaveBeenCalledWith('true');
  });

  it('calls onChange with undefined when the active chip is clicked', async () => {
    const onChange = vi.fn();
    const user = setupUser();
    render(
      <OptionFilter options={BINARY_OPTIONS} value="true" onChange={onChange} variant="chips" />
    );
    await user.click(screen.getByRole('button', { name: /downloaded/i }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('toggles chip selection through controlled state', async () => {
    const user = setupUser();
    render(<Controlled options={THREE_OPTIONS} variant="chips" />);

    const animeBtn = screen.getByRole('button', { name: /anime/i });
    await user.click(animeBtn);
    expect(animeBtn).toHaveAttribute('aria-pressed', 'true');

    await user.click(animeBtn);
    expect(animeBtn).toHaveAttribute('aria-pressed', 'false');
  });
});
