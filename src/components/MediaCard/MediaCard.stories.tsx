import type { Story } from '@ladle/react';
import { MediaCard } from './index';

export const Default: Story = () => (
  <div className="p-8 flex gap-4 w-48">
    <MediaCard id="1" onClick={(id: string) => alert(`Clicked ${id}`)}>
      <MediaCard.Poster
        src="https://image.tmdb.org/t/p/w600_and_h900_bestv2/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg"
        alt="Forrest Gump"
      />
      <MediaCard.Content>
        <MediaCard.Title>Forrest Gump</MediaCard.Title>
        <MediaCard.Year>1994</MediaCard.Year>
      </MediaCard.Content>
    </MediaCard>
  </div>
);

export const Badges: Story = () => (
  <div className="p-8 flex gap-4">
    <div className="w-48">
      <MediaCard id="1">
        <MediaCard.Poster alt="Cover" />
        <MediaCard.StatusBadge status="monitored" />
        <MediaCard.Content>
          <MediaCard.Title>Monitored</MediaCard.Title>
        </MediaCard.Content>
      </MediaCard>
    </div>
    <div className="w-48">
      <MediaCard id="2">
        <MediaCard.Poster alt="Cover" />
        <MediaCard.StatusBadge status="missing" />
        <MediaCard.Content>
          <MediaCard.Title>Missing</MediaCard.Title>
        </MediaCard.Content>
      </MediaCard>
    </div>
    <div className="w-48">
      <MediaCard id="3">
        <MediaCard.Poster alt="Cover" />
        <MediaCard.StatusBadge status="downloaded" />
        <MediaCard.Content>
          <MediaCard.Title>Downloaded</MediaCard.Title>
        </MediaCard.Content>
      </MediaCard>
    </div>
  </div>
);
