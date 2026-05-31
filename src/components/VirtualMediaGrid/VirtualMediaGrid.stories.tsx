import type { Story } from '@ladle/react';
import { MediaCard } from '../MediaCard';
import { VirtualMediaGrid } from './index';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

interface MockItem {
  id: number;
  title: string;
  year: number;
  posterUrl?: string;
}

function makeItems(count: number): MockItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    title: `Movie ${i + 1}`,
    year: 2000 + (i % 25),
    posterUrl: undefined,
  }));
}

function renderItem(item: MockItem) {
  return (
    <MediaCard key={item.id} id={String(item.id)}>
      <MediaCard.Poster alt={item.title} />
      <MediaCard.Content>
        <MediaCard.Title>{item.title}</MediaCard.Title>
        <MediaCard.Year>{item.year}</MediaCard.Year>
      </MediaCard.Content>
    </MediaCard>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export const Loading: Story = () => (
  <div className="bg-surface-bg min-h-screen p-6">
    <VirtualMediaGrid items={[]} renderItem={renderItem} isLoading={true} skeletonCount={24} />
  </div>
);

export const WithItems: Story = () => (
  <div className="bg-surface-bg min-h-screen p-6">
    <VirtualMediaGrid items={makeItems(48)} renderItem={renderItem} isLoading={false} />
  </div>
);

export const SmallSet: Story = () => (
  <div className="bg-surface-bg min-h-screen p-6">
    <VirtualMediaGrid items={makeItems(6)} renderItem={renderItem} isLoading={false} />
  </div>
);

export const Empty: Story = () => (
  <div className="bg-surface-bg min-h-screen p-6">
    <VirtualMediaGrid items={[]} renderItem={renderItem} isLoading={false} />
  </div>
);

export const FetchingMore: Story = () => (
  <div className="bg-surface-bg min-h-screen p-6">
    <VirtualMediaGrid
      items={makeItems(24)}
      renderItem={renderItem}
      isLoading={false}
      isFetchingMore={true}
    />
  </div>
);
