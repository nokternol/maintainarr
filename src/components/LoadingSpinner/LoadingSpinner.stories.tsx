import type { Story } from '@ladle/react';
import LoadingSpinner from './index';

export const Small: Story = () => (
  <div className="bg-slate-950 p-8">
    <LoadingSpinner size="sm" />
  </div>
);

export const Medium: Story = () => (
  <div className="bg-slate-950 p-8">
    <LoadingSpinner size="md" />
  </div>
);

export const Large: Story = () => (
  <div className="bg-slate-950 p-8">
    <LoadingSpinner size="lg" />
  </div>
);

export const AllSizes: Story = () => (
  <div className="bg-slate-950 p-8 flex items-center gap-6">
    <LoadingSpinner size="sm" />
    <LoadingSpinner size="md" />
    <LoadingSpinner size="lg" />
  </div>
);

export const WithText: Story = () => (
  <div className="bg-slate-950 p-8 flex items-center gap-3">
    <LoadingSpinner size="md" />
    <span className="text-slate-300">Loading data...</span>
  </div>
);

export const CenteredInCard: Story = () => (
  <div className="bg-slate-950 p-8">
    <div className="bg-slate-900 rounded-lg p-12 flex flex-col items-center justify-center gap-4">
      <LoadingSpinner size="lg" />
      <p className="text-slate-400">Fetching your data</p>
    </div>
  </div>
);
