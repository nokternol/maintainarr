import type { Story } from '@ladle/react';
import { MediaPoster } from './index';

export const Default: Story = () => (
  <div className="p-8 flex gap-4 h-96">
    <MediaPoster
      src="https://image.tmdb.org/t/p/w600_and_h900_bestv2/arw2vcBveWOVZr6pxd9XTd1TdQa.jpg"
      alt="Forrest Gump"
    />
  </div>
);

export const Fallback: Story = () => (
  <div className="p-8 flex gap-4 h-96">
    <MediaPoster alt="Missing Poster" />
  </div>
);

export const BrokenLink: Story = () => (
  <div className="p-8 flex gap-4 h-96">
    <MediaPoster
      src="https://broken-link.com/img.jpg"
      alt="Broken Link"
      fallbackText="Link Broken"
    />
  </div>
);

export const LoadingSimulation: Story = () => (
  <div className="p-8 flex gap-4 h-96">
    {/* By pointing to an image that takes a long time, we see the skeleton */}
    <MediaPoster src="https://httpbin.org/delay/5" alt="Loading Simulation" />
  </div>
);
