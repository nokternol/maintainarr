import type { Story } from '@ladle/react';
import { MediaCard } from '../MediaCard';
import { MediaGrid } from './index';

const mockItems = Array.from({ length: 12 }).map((_, i) => ({
  id: String(i),
  title: `Sample Movie ${i + 1}`,
  year: 2020 + (i % 5),
  status: (['monitored', 'missing', 'downloaded'] as const)[i % 3],
}));

export const Default: Story = () => (
  <div className="p-8 h-screen overflow-auto">
    <MediaGrid
      items={mockItems}
      renderItem={(item) => (
        <MediaCard key={item.id} id={item.id} onClick={(id) => alert(`Clicked ${id}`)}>
          <MediaCard.Poster alt={item.title} />
          <MediaCard.StatusBadge status={item.status} />
          <MediaCard.Content>
            <MediaCard.Title>{item.title}</MediaCard.Title>
            <MediaCard.Year>{item.year}</MediaCard.Year>
          </MediaCard.Content>
        </MediaCard>
      )}
    />
  </div>
);

export const LoadingState: Story = () => (
  <div className="p-8 h-screen overflow-auto">
    <MediaGrid
      items={mockItems}
      isLoading={true}
      renderItem={(item) => (
        <MediaCard key={item.id} id={item.id}>
          <MediaCard.Poster alt={item.title} />
          <MediaCard.Content>
            <MediaCard.Title>{item.title}</MediaCard.Title>
          </MediaCard.Content>
        </MediaCard>
      )}
    />
  </div>
);
