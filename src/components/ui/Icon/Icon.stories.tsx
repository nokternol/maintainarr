import type { Story } from '@ladle/react';
import Icon from './index';

// Simple SVG icons for demonstration
const CheckIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const StarIcon = () => (
  <svg fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export const ExtraSmall: Story = () => (
  <div className="bg-slate-950 p-8 text-white">
    <Icon size="xs">
      <CheckIcon />
    </Icon>
  </div>
);

export const Small: Story = () => (
  <div className="bg-slate-950 p-8 text-white">
    <Icon size="sm">
      <CheckIcon />
    </Icon>
  </div>
);

export const Medium: Story = () => (
  <div className="bg-slate-950 p-8 text-white">
    <Icon size="md">
      <CheckIcon />
    </Icon>
  </div>
);

export const Large: Story = () => (
  <div className="bg-slate-950 p-8 text-white">
    <Icon size="lg">
      <CheckIcon />
    </Icon>
  </div>
);

export const ExtraLarge: Story = () => (
  <div className="bg-slate-950 p-8 text-white">
    <Icon size="xl">
      <CheckIcon />
    </Icon>
  </div>
);

export const AllSizes: Story = () => (
  <div className="bg-slate-950 p-8 flex items-center gap-4 text-teal-400">
    <Icon size="xs">
      <CheckIcon />
    </Icon>
    <Icon size="sm">
      <CheckIcon />
    </Icon>
    <Icon size="md">
      <CheckIcon />
    </Icon>
    <Icon size="lg">
      <CheckIcon />
    </Icon>
    <Icon size="xl">
      <CheckIcon />
    </Icon>
  </div>
);

export const ColoredIcons: Story = () => (
  <div className="bg-slate-950 p-8 flex gap-4">
    <Icon size="lg" className="text-teal-400">
      <StarIcon />
    </Icon>
    <Icon size="lg" className="text-emerald-500">
      <StarIcon />
    </Icon>
    <Icon size="lg" className="text-amber-500">
      <StarIcon />
    </Icon>
    <Icon size="lg" className="text-red-500">
      <StarIcon />
    </Icon>
  </div>
);
