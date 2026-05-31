import type { Story } from '@ladle/react';
import { ImageFader } from './index';

const IMAGES = [
  'https://picsum.photos/seed/alpha/1280/720',
  'https://picsum.photos/seed/beta/1280/720',
  'https://picsum.photos/seed/gamma/1280/720',
];

export const Default: Story = () => (
  <div className="bg-surface-bg p-8">
    <div className="w-full h-64 relative rounded-lg overflow-hidden">
      <ImageFader images={IMAGES} rotationSpeed={3000} />
    </div>
  </div>
);

export const SingleImage: Story = () => (
  <div className="bg-surface-bg p-8">
    <div className="w-full h-64 relative rounded-lg overflow-hidden">
      <ImageFader images={[IMAGES[0]]} />
    </div>
  </div>
);

export const NoImages: Story = () => (
  <div className="bg-surface-bg p-8">
    <div className="w-full h-64 relative rounded-lg overflow-hidden border border-border flex items-center justify-center">
      <ImageFader images={[]} />
      <span className="text-xs text-text-muted font-mono absolute">ImageFader renders null</span>
    </div>
  </div>
);

export const FastRotation: Story = () => (
  <div className="bg-surface-bg p-8">
    <div className="w-full h-64 relative rounded-lg overflow-hidden">
      <ImageFader images={IMAGES} rotationSpeed={1000} />
    </div>
  </div>
);
