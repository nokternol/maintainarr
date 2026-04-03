import RatingsDisplay from '@app/components/RatingsDisplay';
import { useRatings } from '@app/hooks/useRatings';
import { useEffect } from 'react';

interface RatingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  year?: number;
}

export default function RatingsPanel({ isOpen, onClose, title, year }: RatingsPanelProps) {
  const { trigger, data, isLoading } = useRatings();

  useEffect(() => {
    if (isOpen && title) {
      trigger({ title, year });
    }
  }, [isOpen, title, year, trigger]);

  if (!isOpen) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={`Ratings for ${title}`}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md z-50 flex flex-col bg-surface shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
            {year && <p className="text-sm text-text-secondary">{year}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-background text-text-secondary hover:text-text-primary"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="text-text-secondary text-center py-8">Loading ratings…</div>
          )}
          {data && <RatingsDisplay ratings={data} />}
        </div>
      </div>
    </div>
  );
}
