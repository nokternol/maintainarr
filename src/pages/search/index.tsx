import AppLayout from '@app/components/AppLayout';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { useMetadataSearch } from '@app/hooks/useMetadataSearch';
import type { SearchResult } from '@app/hooks/useMetadataSearch';
import type { SidebarItem } from '@app/types/navigation';
import { useState } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const SearchIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const SettingsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    role="img"
    aria-label="Icon"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
  { id: 'search', label: 'Search', icon: <SearchIcon />, href: '/search', active: true },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon />, href: '/settings' },
];

// ─── Result Section ───────────────────────────────────────────────────────────

function ResultSection({ result }: { result: SearchResult }) {
  const [open, setOpen] = useState(false);

  const statusColor =
    result.status === 'ok'
      ? 'bg-green-500/20 text-green-400'
      : result.status === 'error'
        ? 'bg-red-500/20 text-red-400'
        : 'bg-gray-500/20 text-gray-400';

  return (
    <div className="border border-border rounded-lg bg-surface-panel overflow-hidden">
      <button
        type="button"
        className="w-full flex items-center justify-between p-4 text-left hover:bg-surface-bg transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3">
          <span className="font-medium text-text-primary">{result.name}</span>
          <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
            {result.type}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>{result.status}</span>
        </div>
        <svg
          className={`w-4 h-4 text-text-secondary transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-border">
          {result.status === 'error' && <p className="mt-3 text-sm text-red-400">{result.error}</p>}
          {result.status === 'unavailable' && (
            <p className="mt-3 text-sm text-text-secondary">Provider type not searchable.</p>
          )}
          {result.status === 'ok' && (
            <pre className="mt-3 text-xs text-text-secondary overflow-auto max-h-96 whitespace-pre-wrap break-words">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const { search, results, isLoading, error } = useMetadataSearch();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <AppLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          logo={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-text-primary font-bold">
                M
              </div>
              <span className="text-xl font-bold text-text-primary">Maintainarr</span>
            </div>
          }
        />
      }
      topBar={
        <TopBar
          title="Metadata Search"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Search' }]}
        />
      }
    >
      <div className="p-6 space-y-6">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title across providers…"
            className="flex-1 px-4 py-2 bg-surface-bg border border-border rounded text-text-primary placeholder-text-secondary"
          />
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 bg-primary text-text-primary rounded hover:opacity-90 disabled:opacity-50"
          >
            {isLoading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {error && (
          <div
            className="p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}

        {results !== null && results.length === 0 && (
          <p className="text-text-secondary text-center py-8">No configured providers to search.</p>
        )}

        {results !== null && results.length > 0 && (
          <div className="space-y-3">
            {results.map((r) => (
              <ResultSection key={r.providerId} result={r} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
