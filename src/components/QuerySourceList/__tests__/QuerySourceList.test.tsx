import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import QuerySourceList from '../index';

const savedQueries = [
  { id: 1, name: 'Old Movies' },
  { id: 2, name: 'Watchlist' },
];

describe('QuerySourceList', () => {
  it('renders an "Add query" button when sources is empty', () => {
    render(
      <QuerySourceList sources={[]} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /add query/i })).toBeInTheDocument();
  });

  it('shows preview count for an include source as "N matched"', async () => {
    const sources = [{ queryId: 1, role: 'include' as const, sortOrder: 0 }];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText(/42 matched/i)).toBeInTheDocument());
  });

  it('shows preview count for an exclude source as "N excluded"', async () => {
    const sources = [{ queryId: 2, role: 'exclude' as const, sortOrder: 0 }];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText(/14 excluded/i)).toBeInTheDocument());
  });

  it('shows approximate net count with ~ prefix when both include and exclude sources are present', async () => {
    const sources = [
      { queryId: 1, role: 'include' as const, sortOrder: 0 },
      { queryId: 2, role: 'exclude' as const, sortOrder: 1 },
    ];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    // MSW: id=1 → 42, id=2 → 14; net = 42 - 14 = 28
    await waitFor(() => expect(screen.getByText(/~28 to act on/i)).toBeInTheDocument());
  });

  it('shows an inline error when sources has no include entry with a selected query', () => {
    const sources = [{ queryId: 1, role: 'exclude' as const, sortOrder: 0 }];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    expect(screen.getByText(/at least one include/i)).toBeInTheDocument();
  });

  it('hides the error when at least one include source with a valid queryId is present', () => {
    const sources = [{ queryId: 1, role: 'include' as const, sortOrder: 0 }];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    expect(screen.queryByText(/at least one include/i)).not.toBeInTheDocument();
  });

  it('shows a complexity nudge when there are 3 or more exclude sources', () => {
    const sources = [
      { queryId: 1, role: 'include' as const, sortOrder: 0 },
      { queryId: 2, role: 'exclude' as const, sortOrder: 1 },
      { queryId: 3, role: 'exclude' as const, sortOrder: 2 },
      { queryId: 4, role: 'exclude' as const, sortOrder: 3 },
    ];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    expect(screen.getByText(/complex exclusion rules/i)).toBeInTheDocument();
  });

  it('does not show the nudge with fewer than 3 exclude sources', () => {
    const sources = [
      { queryId: 1, role: 'include' as const, sortOrder: 0 },
      { queryId: 2, role: 'exclude' as const, sortOrder: 1 },
      { queryId: 3, role: 'exclude' as const, sortOrder: 2 },
    ];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={vi.fn()} />
    );
    expect(screen.queryByText(/complex exclusion rules/i)).not.toBeInTheDocument();
  });

  it('changing role on a source calls onChange with the updated role', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const sources = [{ queryId: 1, role: 'include' as const, sortOrder: 0 }];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={onChange} />
    );
    await user.selectOptions(screen.getByRole('combobox'), 'exclude');
    expect(onChange).toHaveBeenCalledOnce();
    const [result] = onChange.mock.calls[0] as [typeof sources];
    expect(result[0].role).toBe('exclude');
  });

  it('clicking the remove button calls onChange with that source removed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const sources = [
      { queryId: 1, role: 'include' as const, sortOrder: 0 },
      { queryId: 2, role: 'exclude' as const, sortOrder: 1 },
    ];
    render(
      <QuerySourceList sources={sources} savedQueries={savedQueries} onChange={onChange} />
    );
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledOnce();
    const [result] = onChange.mock.calls[0] as [typeof sources];
    expect(result).toHaveLength(1);
    expect(result[0].queryId).toBe(2);
  });

  it('clicking "Add query" calls onChange with one new include entry', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <QuerySourceList sources={[]} savedQueries={savedQueries} onChange={onChange} />
    );
    await user.click(screen.getByRole('button', { name: /add query/i }));
    expect(onChange).toHaveBeenCalledOnce();
    const [result] = onChange.mock.calls[0] as [ReturnType<typeof onChange>];
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ role: 'include', sortOrder: 0 });
  });
});
