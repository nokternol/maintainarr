import type { Story } from '@ladle/react';
import RatingsForm from './index';

export const Default: Story = () => (
  <div style={{ padding: '1.5rem', maxWidth: '32rem' }}>
    <RatingsForm onSubmit={(values) => console.log('Submitted:', values)} />
  </div>
);

export const Loading: Story = () => (
  <div style={{ padding: '1.5rem', maxWidth: '32rem' }}>
    <RatingsForm onSubmit={() => {}} isLoading />
  </div>
);
