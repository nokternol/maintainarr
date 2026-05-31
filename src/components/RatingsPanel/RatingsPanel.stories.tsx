import type { Story } from '@ladle/react';
import { useState } from 'react';
import RatingsPanel from './index';

// ─── Wrapper ──────────────────────────────────────────────────────────────────

function PanelWrapper({
  title,
  year,
  initialOpen = true,
}: {
  title: string;
  year?: number;
  initialOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(initialOpen);

  return (
    <div className="bg-surface-bg min-h-screen relative">
      <div className="p-8">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="px-4 py-2 bg-primary text-white text-sm rounded-sm"
        >
          Open ratings panel
        </button>
        <p className="mt-2 text-xs text-text-muted font-mono">
          isOpen: {isOpen ? 'true' : 'false'}
        </p>
      </div>

      <RatingsPanel isOpen={isOpen} onClose={() => setIsOpen(false)} title={title} year={year} />
    </div>
  );
}

// ─── Stories ──────────────────────────────────────────────────────────────────

export const OpenWithYear: Story = () => (
  <PanelWrapper title="Breaking Bad" year={2008} initialOpen={true} />
);

export const OpenWithoutYear: Story = () => <PanelWrapper title="Dune" initialOpen={true} />;

export const Closed: Story = () => (
  <PanelWrapper title="The Matrix" year={1999} initialOpen={false} />
);

export const LongTitle: Story = () => (
  <PanelWrapper
    title="The Lord of the Rings: The Return of the King Extended Edition"
    year={2003}
    initialOpen={true}
  />
);
