import type { Story } from '@ladle/react';
import Card from './index';

export const Default: Story = () => (
  <div className="bg-surface-bg p-8">
    <Card>
      <p className="text-text-primary">This is a default card with standard styling.</p>
    </Card>
  </div>
);

export const Outlined: Story = () => (
  <div className="bg-surface-bg p-8">
    <Card variant="outlined">
      <p className="text-text-primary">This is an outlined card with a border.</p>
    </Card>
  </div>
);

export const Elevated: Story = () => (
  <div className="bg-surface-bg p-8">
    <Card variant="elevated">
      <p className="text-text-primary">This is an elevated card with a shadow.</p>
    </Card>
  </div>
);

export const WithHeader: Story = () => (
  <div className="bg-surface-bg p-8">
    <Card header={<h3 className="text-text-primary font-semibold">Card Title</h3>}>
      <p className="text-text-secondary">This card has a header section with a title.</p>
    </Card>
  </div>
);

export const WithHeaderAndFooter: Story = () => (
  <div className="bg-surface-bg p-8">
    <Card
      header={<h3 className="text-text-primary font-semibold">Card Title</h3>}
      footer={
        <div className="flex justify-end gap-2">
          <button className="px-3 py-1.5 text-sm bg-surface-panel border border-border hover:bg-surface-bg text-text-primary rounded-md transition-colors">
            Cancel
          </button>
          <button className="px-3 py-1.5 text-sm bg-primary hover:bg-primary-hover text-text-primary rounded-md transition-colors">
            Save
          </button>
        </div>
      }
    >
      <p className="text-text-secondary">This card has both a header and footer section.</p>
    </Card>
  </div>
);

export const PaddingSizes: Story = () => (
  <div className="bg-surface-bg p-8 space-y-4">
    <Card padding="sm" variant="outlined">
      <p className="text-text-primary">Small padding card</p>
    </Card>
    <Card padding="md" variant="outlined">
      <p className="text-text-primary">Medium padding card (default)</p>
    </Card>
    <Card padding="lg" variant="outlined">
      <p className="text-text-primary">Large padding card</p>
    </Card>
  </div>
);

export const NoPadding: Story = () => (
  <div className="bg-surface-bg p-8">
    <Card padding="none" variant="outlined">
      <div className="p-4">
        <p className="text-text-primary">
          This card has no automatic padding, allowing full control over internal spacing.
        </p>
      </div>
    </Card>
  </div>
);

export const AllVariants: Story = () => (
  <div className="bg-surface-bg p-8 space-y-4">
    <Card variant="default">
      <p className="text-text-primary">Default variant</p>
    </Card>
    <Card variant="outlined">
      <p className="text-text-primary">Outlined variant</p>
    </Card>
    <Card variant="elevated">
      <p className="text-text-primary">Elevated variant</p>
    </Card>
  </div>
);
