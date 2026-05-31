import '@testing-library/jest-dom/vitest';
import { render, screen, setupUser } from '@tests/helpers/component';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from '../index';
import type { Tab } from '../index';

const TWO_TABS: Tab<string>[] = [
  { value: 'movies', label: 'Movies' },
  { value: 'series', label: 'Series' },
];

const THREE_TABS: Tab<string>[] = [
  { value: 'all', label: 'All', count: 100 },
  { value: 'movies', label: 'Movies', count: 60 },
  { value: 'series', label: 'Series', count: 40 },
];

function Controlled({
  tabs,
  initial,
}: {
  tabs: Tab<string>[];
  initial: string;
}) {
  const [active, setActive] = useState(initial);
  return <Tabs tabs={tabs} active={active} onChange={setActive} />;
}

// ─── Rendering ────────────────────────────────────────────────────────────────

describe('Tabs — rendering', () => {
  it('renders a tablist', () => {
    render(<Tabs tabs={TWO_TABS} active="movies" onChange={vi.fn()} />);
    expect(screen.getByRole('tablist')).toBeInTheDocument();
  });

  it('renders a tab button for each entry', () => {
    render(<Tabs tabs={TWO_TABS} active="movies" onChange={vi.fn()} />);
    expect(screen.getAllByRole('tab')).toHaveLength(2);
  });

  it('marks the active tab with aria-selected=true', () => {
    render(<Tabs tabs={TWO_TABS} active="series" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /series/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /movies/i })).toHaveAttribute('aria-selected', 'false');
  });

  it('sets tabIndex=0 on active tab and -1 on others', () => {
    render(<Tabs tabs={TWO_TABS} active="movies" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /movies/i })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('tab', { name: /series/i })).toHaveAttribute('tabindex', '-1');
  });

  it('each tab has a matching id and aria-controls attributes', () => {
    render(<Tabs tabs={TWO_TABS} active="movies" onChange={vi.fn()} />);
    const moviesTab = screen.getByRole('tab', { name: /movies/i });
    expect(moviesTab).toHaveAttribute('id', 'tab-movies');
    expect(moviesTab).toHaveAttribute('aria-controls', 'tabpanel-movies');
  });

  it('renders count alongside the label', () => {
    render(<Tabs tabs={THREE_TABS} active="all" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /movies/i })).toHaveTextContent('60');
  });

  it('does not render count when loading is true', () => {
    const tabs: Tab<string>[] = [{ value: 'movies', label: 'Movies', count: 60, loading: true }];
    render(<Tabs tabs={tabs} active="movies" onChange={vi.fn()} />);
    expect(screen.getByRole('tab', { name: /movies/i })).not.toHaveTextContent('60');
  });
});

// ─── Click interaction ────────────────────────────────────────────────────────

describe('Tabs — click interaction', () => {
  it('calls onChange with the clicked tab value', async () => {
    const onChange = vi.fn();
    const user = setupUser();
    render(<Tabs tabs={TWO_TABS} active="movies" onChange={onChange} />);
    await user.click(screen.getByRole('tab', { name: /series/i }));
    expect(onChange).toHaveBeenCalledWith('series');
  });

  it('switches active tab through controlled state', async () => {
    const user = setupUser();
    render(<Controlled tabs={TWO_TABS} initial="movies" />);

    expect(screen.getByRole('tab', { name: /movies/i })).toHaveAttribute('aria-selected', 'true');
    await user.click(screen.getByRole('tab', { name: /series/i }));
    expect(screen.getByRole('tab', { name: /series/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: /movies/i })).toHaveAttribute('aria-selected', 'false');
  });
});

// ─── Keyboard navigation ──────────────────────────────────────────────────────

describe('Tabs — keyboard navigation', () => {
  it('moves to the next tab on ArrowRight', async () => {
    const user = setupUser();
    render(<Controlled tabs={TWO_TABS} initial="movies" />);
    screen.getByRole('tab', { name: /movies/i }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /series/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps around from last to first tab on ArrowRight', async () => {
    const user = setupUser();
    render(<Controlled tabs={TWO_TABS} initial="series" />);
    screen.getByRole('tab', { name: /series/i }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: /movies/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('moves to the previous tab on ArrowLeft', async () => {
    const user = setupUser();
    render(<Controlled tabs={TWO_TABS} initial="series" />);
    screen.getByRole('tab', { name: /series/i }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /movies/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('wraps around from first to last tab on ArrowLeft', async () => {
    const user = setupUser();
    render(<Controlled tabs={TWO_TABS} initial="movies" />);
    screen.getByRole('tab', { name: /movies/i }).focus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: /series/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('jumps to first tab on Home', async () => {
    const user = setupUser();
    render(<Controlled tabs={THREE_TABS} initial="series" />);
    screen.getByRole('tab', { name: /series/i }).focus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('tab', { name: /all/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('jumps to last tab on End', async () => {
    const user = setupUser();
    render(<Controlled tabs={THREE_TABS} initial="all" />);
    screen.getByRole('tab', { name: /all/i }).focus();
    await user.keyboard('{End}');
    expect(screen.getByRole('tab', { name: /series/i })).toHaveAttribute('aria-selected', 'true');
  });
});
