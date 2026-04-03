import AppLayout from '@app/components/AppLayout';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { useProviderSettings } from '@app/hooks/useProviderSettings';
import type { CreateProviderParams, ProviderSummary } from '@app/hooks/useProviderSettings';
import type { SidebarItem } from '@app/types/navigation';
import { useState } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-label="Icon">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-label="Icon">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
  { id: 'settings', label: 'Settings', icon: <SettingsIcon />, href: '/settings', active: true },
];

// ─── Add Provider Form ────────────────────────────────────────────────────────

const PROVIDER_TYPES = ['PLEX', 'JELLYFIN', 'SONARR', 'RADARR', 'TAUTULLI', 'OVERSEERR', 'TMDB', 'OMDB'] as const;

interface AddFormState {
  type: string;
  name: string;
  url: string;
  apiKey: string;
}

function AddProviderForm({ onSubmit, onCancel }: { onSubmit: (params: CreateProviderParams) => void; onCancel: () => void }) {
  const [form, setForm] = useState<AddFormState>({ type: 'RADARR', name: '', url: '', apiKey: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ type: form.type, name: form.name, url: form.url, apiKey: form.apiKey || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border border-border rounded-lg bg-surface">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Type</label>
          <select
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary"
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Radarr"
            className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">URL</label>
          <input
            type="url"
            value={form.url}
            onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
            placeholder="http://localhost:7878/api/v3"
            className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-text-secondary mb-1">API Key</label>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder="Optional"
            className="w-full px-3 py-2 bg-background border border-border rounded text-text-primary"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button type="button" onClick={onCancel} className="px-4 py-2 text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button type="submit" className="px-4 py-2 bg-primary text-text-primary rounded hover:opacity-90">
          Save
        </button>
      </div>
    </form>
  );
}

// ─── Provider Row ─────────────────────────────────────────────────────────────

function ProviderRow({ provider, onDelete }: { provider: ProviderSummary; onDelete: () => void }) {
  return (
    <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-surface">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="font-medium text-text-primary">{provider.name}</span>
          <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">{provider.type}</span>
          {!provider.isActive && (
            <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded">Inactive</span>
          )}
        </div>
        <div className="text-sm text-text-secondary">{provider.url}</div>
      </div>
      <button
        onClick={onDelete}
        className="px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10 rounded"
        aria-label={`Delete ${provider.name}`}
      >
        Delete
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { providers, isLoading, create, remove } = useProviderSettings();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleCreate = async (params: CreateProviderParams) => {
    await create(params);
    setShowAddForm(false);
  };

  return (
    <AppLayout
      sidebar={
        <Sidebar
          items={sidebarItems}
          logo={
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-text-primary font-bold">M</div>
              <span className="text-xl font-bold text-text-primary">Maintainarr</span>
            </div>
          }
        />
      }
      topBar={
        <TopBar
          title="Provider Settings"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Settings' }]}
        />
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button
            onClick={() => setShowAddForm((v) => !v)}
            className="px-4 py-2 bg-primary text-text-primary rounded hover:opacity-90"
          >
            Add Provider
          </button>
        </div>

        {showAddForm && (
          <AddProviderForm onSubmit={handleCreate} onCancel={() => setShowAddForm(false)} />
        )}

        {isLoading && <div className="text-text-secondary">Loading providers…</div>}

        <div className="space-y-3">
          {providers?.map((p) => (
            <ProviderRow key={p.id} provider={p} onDelete={() => remove(p.id)} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
