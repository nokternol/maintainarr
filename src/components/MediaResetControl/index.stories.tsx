import type { Story } from '@ladle/react';
import { useEffect, useRef } from 'react';
import MediaResetControl from './index';

const neverResolves = () => new Promise<{ deletedIdentities: number }>(() => {});
const resolves = async () => ({ deletedIdentities: 3210 });
const rejects = async (): Promise<{ deletedIdentities: number }> => {
  throw new Error('Failed to reset media data');
};

/** Clicks "Reset media data" then types RESET, driving the control into its confirming panel. */
function Confirming({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.querySelector('button')?.click();
    setTimeout(() => {
      const input = ref.current?.querySelector('input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(input, 'RESET');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }, []);
  return <div ref={ref}>{children}</div>;
}

/** Drives past confirming into the reset button itself, for stories that need it clicked too. */
function Triggered({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const buttons = ref.current?.querySelectorAll('button');
    buttons?.[0]?.click();
    setTimeout(() => {
      const input = ref.current?.querySelector('input');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value'
        )?.set;
        setter?.call(input, 'RESET');
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      setTimeout(() => {
        ref.current?.querySelectorAll('button')?.[0]?.click();
      }, 0);
    }, 0);
  }, []);
  return <div ref={ref}>{children}</div>;
}

export const MediaResetCollapsed: Story = () => (
  <div className="p-6">
    <MediaResetControl onReset={resolves} />
  </div>
);

export const MediaResetConfirming: Story = () => (
  <div className="p-6">
    <Confirming>
      <MediaResetControl onReset={resolves} />
    </Confirming>
  </div>
);
MediaResetConfirming.storyName = 'Confirming (type RESET, not yet submitted)';

export const MediaResetResetting: Story = () => (
  <div className="p-6">
    <Triggered>
      <MediaResetControl onReset={neverResolves} />
    </Triggered>
  </div>
);
MediaResetResetting.storyName = 'Resetting (in flight, never resolves)';

export const MediaResetSuccess: Story = () => (
  <div className="p-6">
    <Triggered>
      <MediaResetControl onReset={resolves} />
    </Triggered>
  </div>
);
MediaResetSuccess.storyName = 'Success (deleted count confirmation)';

export const MediaResetError: Story = () => (
  <div className="p-6">
    <Triggered>
      <MediaResetControl onReset={rejects} />
    </Triggered>
  </div>
);
MediaResetError.storyName = 'Error (recoverable, Retry available)';
