import type { Story } from '@ladle/react';
import Button from './index';

export const Primary: Story = () => <Button variant="primary">Primary Action</Button>;

export const Secondary: Story = () => <Button variant="secondary">Secondary Action</Button>;

export const Danger: Story = () => <Button variant="danger">Danger Button</Button>;

// Showcase how the buttons look on the actual "Surface" colors we defined
export const ThemeShowcase: Story = () => (
  <div className="flex flex-col gap-8 p-8">
    {/* Light Mode Section */}
    <div className="p-8 rounded-xl bg-surface border border-gray-200">
      <h3 className="text-slate-950 font-bold mb-4">Light Mode Surface (gray-50)</h3>
      <div className="flex gap-4 p-6 bg-white rounded-lg shadow-sm border border-gray-100">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
      </div>
    </div>

    {/* Dark Mode Section */}
    <div className="p-8 rounded-xl bg-surface-dark dark">
      <h3 className="text-white font-bold mb-4">Dark Mode Surface (slate-950)</h3>
      <div className="flex gap-4 p-6 bg-surface-card rounded-lg border border-gray-800">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
      </div>
    </div>
  </div>
);

export const Sizes: Story = () => (
  <div className="flex items-end gap-4">
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const States: Story = () => (
  <div className="flex gap-4">
    <Button loading>Processing...</Button>
    <Button disabled>Action Disabled</Button>
  </div>
);

export const AllVariants: Story = () => (
  <div className="flex flex-col gap-10 p-4">
    <section>
      <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">
        Intent Variants
      </p>
      <div className="flex gap-4">
        <Button variant="primary">Primary (Teal 600)</Button>
        <Button variant="secondary">Secondary (Gray 600)</Button>
        <Button variant="danger">Danger (Red)</Button>
      </div>
    </section>

    <section>
      <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">
        Sizing Scale
      </p>
      <div className="flex items-center gap-4">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </div>
    </section>

    <section>
      <p className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase mb-4">
        Interactive States
      </p>
      <div className="flex gap-4">
        <Button loading>Loading State</Button>
        <Button disabled>Disabled State</Button>
      </div>
    </section>
  </div>
);

AllVariants.meta = {
  title: 'All Button Variants',
};