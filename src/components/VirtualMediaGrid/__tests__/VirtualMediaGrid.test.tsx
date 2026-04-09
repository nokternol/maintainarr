import { render, screen, waitFor } from '@tests/helpers/component';
import { describe, expect, it } from 'vitest';
import { MediaCard } from '../../MediaCard';
import { VirtualMediaGrid } from '../index';

interface TestItem {
  id: number;
  title: string;
}

function makeItems(count: number): TestItem[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, title: `Item ${i + 1}` }));
}

const renderItem = (item: TestItem) => (
  <div key={item.id} data-testid={`item-${item.id}`}>
    {item.title}
  </div>
);

describe('MediaCard.Skeleton', () => {
  it('renders without props', () => {
    render(<MediaCard.Skeleton />);
    expect(screen.getByTestId('media-card-skeleton')).toBeInTheDocument();
  });

  it('contains skeleton elements', () => {
    render(<MediaCard.Skeleton />);
    const skeletons = screen.getAllByTestId('skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('VirtualMediaGrid', () => {
  it('renders skeletonCount skeleton cards when isLoading is true', () => {
    render(
      <VirtualMediaGrid items={[]} renderItem={renderItem} isLoading={true} skeletonCount={12} />
    );

    const skeletons = screen.getAllByTestId('media-card-skeleton');
    expect(skeletons).toHaveLength(12);
  });

  it('renders 48 skeleton cards by default when isLoading', () => {
    render(<VirtualMediaGrid items={[]} renderItem={renderItem} isLoading={true} />);
    const skeletons = screen.getAllByTestId('media-card-skeleton');
    expect(skeletons).toHaveLength(48);
  });

  it('does not render skeleton cards when isLoading is false and items are present', async () => {
    render(<VirtualMediaGrid items={makeItems(4)} renderItem={renderItem} isLoading={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId('media-card-skeleton')).toHaveLength(0);
  });

  it('renders items when not loading', async () => {
    render(<VirtualMediaGrid items={makeItems(4)} renderItem={renderItem} isLoading={false} />);

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
      expect(screen.getByTestId('item-4')).toBeInTheDocument();
    });
  });

  it('does not crash with empty items and isLoading false', () => {
    expect(() =>
      render(<VirtualMediaGrid items={[]} renderItem={renderItem} isLoading={false} />)
    ).not.toThrow();
  });

  it('renders a skeleton row when isFetchingMore is true', async () => {
    render(<VirtualMediaGrid items={makeItems(4)} renderItem={renderItem} isFetchingMore={true} />);

    await waitFor(() => {
      const skeletons = screen.getAllByTestId('media-card-skeleton');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  it('does not render skeleton row when isFetchingMore is false', async () => {
    render(
      <VirtualMediaGrid items={makeItems(4)} renderItem={renderItem} isFetchingMore={false} />
    );

    await waitFor(() => {
      expect(screen.getByTestId('item-1')).toBeInTheDocument();
    });

    expect(screen.queryAllByTestId('media-card-skeleton')).toHaveLength(0);
  });
});
