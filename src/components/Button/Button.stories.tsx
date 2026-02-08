import type { Story } from '@ladle/react';
import Button from './index';

export const Primary: Story = () => <Button>Primary Button</Button>;

export const Secondary: Story = () => <Button variant="secondary">Secondary Button</Button>;

export const Danger: Story = () => <Button variant="danger">Danger Button</Button>;

export const Sizes: Story = () => (
  <div className="flex flex-col gap-4">
    <Button size="sm">Small Button</Button>
    <Button size="md">Medium Button</Button>
    <Button size="lg">Large Button</Button>
  </div>
);

export const Loading: Story = () => <Button loading>Loading Button</Button>;

export const Disabled: Story = () => <Button disabled>Disabled Button</Button>;

export const AllVariants: Story = () => (
  <div className="flex flex-col gap-4">
    <div className="flex gap-4">
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="danger">Danger</Button>
    </div>
    <div className="flex gap-4">
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
    </div>
    <div className="flex gap-4">
      <Button loading>Loading</Button>
      <Button disabled>Disabled</Button>
    </div>
  </div>
);

AllVariants.meta = {
  title: 'All Button Variants',
};
