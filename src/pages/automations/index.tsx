import AppLayout from '@app/components/AppLayout';
import SidebarNav from '@app/components/SidebarNav';
import TopBar from '@app/components/TopBar';
import { buildQueryParams, useSavedQueries } from '@app/hooks/useSavedQueries';
import type { SavedQuery } from '@app/hooks/useSavedQueries';
import { cn } from '@app/lib/utils/cn';
import { summarizeFilters } from '@app/lib/utils/filterSummary';
import { requireAuth } from '@app/lib/utils/requireAuth';
import { BookMarked, Clapperboard, Trash2, Zap } from 'lucide-react';
import type { GetServerSideProps } from 'next';
import { useRouter } from 'next/router';
import { useState } from 'react';

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

// ─── QueryRow ─────────────────────────────────────────────────────────────────

function QueryRow({
  query,
  onLoad,
  onDelete,
}: {
  query: SavedQuery;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const parts = summarizeFilters(query.filters);
  const date = new Date(query.createdAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const handleDeleteClick = () => {
    if (confirming) {
      onDelete();
    } else {
      setConfirming(true);
    }
  };

  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3.5 group hover:bg-surface-bg/50 transition-colors">
      {/* Left: name + summary */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary leading-tight truncate">{query.name}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
          {parts.length > 0 ? (
            parts.slice(0, 6).map((part) => (
              <span
                key={part}
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-surface-bg text-text-muted border border-border leading-none"
              >
                {part}
              </span>
            ))
          ) : (
            <span className="text-xs text-text-muted italic">No filters</span>
          )}
          {parts.length > 6 && (
            <span className="text-[11px] text-text-muted">+{parts.length - 6} more</span>
          )}
        </div>
        <p className="text-[11px] text-text-muted mt-1.5">{date}</p>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 flex-shrink-0 pt-0.5">
        {confirming ? (
          <>
            <span className="text-xs text-danger font-medium">Delete query?</span>
            <button
              type="button"
              onClick={handleDeleteClick}
              className="px-2.5 py-1 text-xs font-medium rounded-sm bg-danger text-white hover:bg-danger-hover transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="px-2.5 py-1 text-xs font-medium rounded-sm bg-surface-panel border border-border text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={onLoad}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-sm bg-surface-panel border border-border text-text-secondary hover:text-text-primary hover:bg-surface-bg transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
            >
              <Clapperboard size={12} strokeWidth={2} aria-hidden="true" />
              Load
            </button>
            <button
              type="button"
              onClick={handleDeleteClick}
              aria-label={`Delete query "${query.name}"`}
              className="flex items-center justify-center w-7 h-7 rounded text-text-muted hover:text-danger hover:bg-danger/10 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-danger opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
            >
              <Trash2 size={13} strokeWidth={2} aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const router = useRouter();
  const { queries, remove } = useSavedQueries();

  const handleLoad = (query: SavedQuery) => {
    const params = buildQueryParams(query.filters);
    void router.push(params ? `/media?${params}` : '/media');
  };

  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar
          title="Automations"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }]}
          actions={
            <button
              type="button"
              disabled={queries.length === 0}
              title={
                queries.length === 0 ? 'Save a query first to create an automation' : undefined
              }
              className={cn(
                'px-4 py-2 text-white text-sm font-medium rounded-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg',
                queries.length === 0
                  ? 'bg-primary/40 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary-hover'
              )}
            >
              + New automation
            </button>
          }
        />
      }
    >
      <div className="p-6 space-y-8 max-w-3xl">
        {/* ── Saved Queries section ──────────────────────────────────────────── */}
        <section aria-labelledby="saved-queries-heading">
          <div className="flex items-center gap-3 mb-1">
            <BookMarked
              size={16}
              strokeWidth={1.75}
              className="text-primary flex-shrink-0"
              aria-hidden="true"
            />
            <h2 id="saved-queries-heading" className="text-sm font-semibold text-text-primary">
              Saved Queries
            </h2>
          </div>
          <p className="text-xs text-text-muted mb-4 ml-[28px]">
            Named filter sets from the Media page. Each automation targets one saved query.
          </p>

          {queries.length === 0 ? (
            <div className="rounded-lg border border-border bg-surface-panel overflow-hidden">
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                <BookMarked
                  size={28}
                  strokeWidth={1.25}
                  className="text-text-muted"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-text-secondary">No saved queries yet</p>
                <p className="text-xs text-text-muted max-w-xs">
                  Go to the Media page, apply any combination of filters, and use the "Save as
                  query" button to save them here.
                </p>
                <a
                  href="/media"
                  className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-sm bg-primary text-white hover:bg-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg"
                >
                  <Clapperboard size={12} strokeWidth={2} aria-hidden="true" />
                  Go to Media
                </a>
              </div>
            </div>
          ) : (
            <div
              className="rounded-lg border border-border bg-surface-panel overflow-hidden divide-y divide-divider"
              role="list"
              aria-label="Saved queries"
            >
              {queries.map((query) => (
                <div key={query.id} role="listitem">
                  <QueryRow
                    query={query}
                    onLoad={() => handleLoad(query)}
                    onDelete={() => remove(query.id)}
                  />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Automations section ────────────────────────────────────────────── */}
        <section aria-labelledby="automations-heading">
          <div className="flex items-center gap-3 mb-1">
            <Zap
              size={16}
              strokeWidth={1.75}
              className="text-text-muted flex-shrink-0"
              aria-hidden="true"
            />
            <h2 id="automations-heading" className="text-sm font-semibold text-text-primary">
              Automations
            </h2>
          </div>
          <p className="text-xs text-text-muted mb-4 ml-[28px]">
            Each automation pairs a saved query with a scheduled task and a cron schedule.
          </p>

          <div className="rounded-lg border border-border bg-surface-panel overflow-hidden">
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
              <Zap size={28} strokeWidth={1.25} className="text-text-muted" aria-hidden="true" />
              <p className="text-sm font-medium text-text-secondary">No automations yet</p>
              <p className="text-xs text-text-muted max-w-xs">
                {queries.length === 0
                  ? 'Save a query first, then create an automation to run it on a schedule.'
                  : 'Select a saved query above and configure a task and schedule to build your first automation.'}
              </p>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
