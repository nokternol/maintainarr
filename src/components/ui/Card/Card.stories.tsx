import type { Story } from '@ladle/react';
import Card from './index';

export const Default: Story = () => (
  <div className="bg-slate-950 p-8">
    <Card>
      <p className="text-white">This is a default card with standard styling.</p>
    </Card>
  </div>
);

export const Outlined: Story = () => (
  <div className="bg-slate-950 p-8">
    <Card variant="outlined">
      <p className="text-white">This is an outlined card with a border.</p>
    </Card>
  </div>
);

export const Elevated: Story = () => (
  <div className="bg-slate-950 p-8">
    <Card variant="elevated">
      <p className="text-white">This is an elevated card with a shadow.</p>
    </Card>
  </div>
);

export const WithHeader: Story = () => (
  <div className="bg-slate-950 p-8">
    <Card header={<h3 className="text-white font-semibold">Card Title</h3>}>
      <p className="text-slate-300">This card has a header section with a title.</p>
    </Card>
  </div>
);

export const WithHeaderAndFooter: Story = () => (
  <div className="bg-slate-950 p-8">
    <Card
      header={<h3 className="text-white font-semibold">Card Title</h3>}
      footer={
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors">
            Cancel
          </button>
          <button className="px-3 py-1.5 text-sm bg-teal-600 hover:bg-teal-700 text-white rounded-md transition-colors">
            Save
          </button>
        </div>
      }
    >
      <p className="text-slate-300">This card has both a header and footer section.</p>
    </Card>
  </div>
);

export const PaddingSizes: Story = () => (
  <div className="bg-slate-950 p-8 space-y-4">
    <Card padding="sm" variant="outlined">
      <p className="text-white">Small padding card</p>
    </Card>
    <Card padding="md" variant="outlined">
      <p className="text-white">Medium padding card (default)</p>
    </Card>
    <Card padding="lg" variant="outlined">
      <p className="text-white">Large padding card</p>
    </Card>
  </div>
);

export const NoPadding: Story = () => (
  <div className="bg-slate-950 p-8">
    <Card padding="none" variant="outlined">
      <div className="p-4">
        <p className="text-white">
          This card has no automatic padding, allowing full control over internal spacing.
        </p>
      </div>
    </Card>
  </div>
);

export const AllVariants: Story = () => (
  <div className="bg-slate-950 p-8 space-y-4">
    <Card variant="default">
      <p className="text-white">Default variant</p>
    </Card>
    <Card variant="outlined">
      <p className="text-white">Outlined variant</p>
    </Card>
    <Card variant="elevated">
      <p className="text-white">Elevated variant</p>
    </Card>
  </div>
);
