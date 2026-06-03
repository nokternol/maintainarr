import { cn } from '@app/lib/utils/cn';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';

export interface SaveQueryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
}

export function SaveQueryDialog({ open, onClose, onSave }: SaveQueryDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const inputId = useId();
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      setName('');
      setError('');
      requestAnimationFrame(() => inputRef.current?.select());
    } else {
      if (dialog.open) dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handler = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    dialog.addEventListener('cancel', handler);
    return () => dialog.removeEventListener('cancel', handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name for this query.');
      inputRef.current?.focus();
      return;
    }
    onSave(trimmed);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={headingId}
      className="m-auto p-0 bg-transparent max-w-sm w-full border-none outline-none backdrop:bg-black/60"
    >
      <div
        className="bg-surface-elevated rounded-lg overflow-hidden"
        style={{
          boxShadow:
            'inset 0 0 0 1px rgba(13,148,136,0.35), 0 0 0 1px rgba(13,148,136,0.14), 0 10px 48px rgba(13,148,136,0.16), 0 3px 12px rgba(0,0,0,0.70)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-divider">
          <h2 id={headingId} className="text-sm font-semibold text-text-primary">
            Save as query
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-6 h-6 rounded text-text-muted hover:text-text-primary hover:bg-surface-panel transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
          >
            <X size={13} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} noValidate className="px-5 py-4 space-y-4">
          <div>
            <label
              htmlFor={inputId}
              className="block text-xs font-medium text-text-secondary mb-1.5"
            >
              Query name
            </label>
            <input
              ref={inputRef}
              id={inputId}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              placeholder="e.g. Unwatched 4K movies"
              maxLength={80}
              autoComplete="off"
              className={cn(
                'w-full px-3 py-2 rounded text-sm bg-surface-bg border text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary transition-colors',
                error ? 'border-danger' : 'border-border'
              )}
            />
            {error ? (
              <p role="alert" className="mt-1.5 text-xs text-danger">
                {error}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-text-muted">
                The active filters will be saved with this name.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium rounded-sm bg-surface-panel border border-border text-text-secondary hover:bg-surface-bg hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium rounded-sm bg-primary text-white hover:bg-primary-hover active:bg-primary-active transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-surface-elevated"
            >
              Save query
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
