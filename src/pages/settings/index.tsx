import AppLayout from '@app/components/AppLayout';
import Button from '@app/components/Button';
import SidebarNav from '@app/components/SidebarNav';
import { Skeleton } from '@app/components/Skeleton';
import TopBar from '@app/components/TopBar';
import { useProviderSettings } from '@app/hooks/useProviderSettings';
import type {
  CreateProviderParams,
  ProviderSummary,
  UpdateProviderParams,
} from '@app/hooks/useProviderSettings';
import { requireAuth } from '@app/lib/utils/requireAuth';
import type { GetServerSideProps } from 'next';
import { useRef, useState } from 'react';

// ─── API suffix map ────────────────────────────────────────────────────────────

const API_SUFFIXES: Record<string, string> = {
  SONARR: '/api/v3',
  RADARR: '/api/v3',
  PLEX: '',
  JELLYFIN: '',
  TAUTULLI: '',
  OVERSEERR: '',
  TMDB: '',
  OMDB: '',
};

// ─── Default URLs for providers with fixed base URLs ──────────────────────────

const PROVIDER_DEFAULT_URLS: Partial<Record<string, string>> = {
  TMDB: 'https://api.themoviedb.org/3',
  OMDB: 'http://www.omdbapi.com',
};

// ─── Connection status ────────────────────────────────────────────────────────

type TestStatus = 'idle' | 'loading' | 'pass' | 'fail';

function ConnectionIcon({ status }: { status: TestStatus }) {
  if (status === 'idle') {
    return <span className="inline-block w-3 h-3 rounded-full bg-text-muted" title="Not tested" />;
  }
  if (status === 'loading') {
    return (
      <svg
        className="inline-block w-4 h-4 animate-spin text-text-secondary"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    );
  }
  if (status === 'pass') {
    return (
      <svg
        className="inline-block w-4 h-4 text-success"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    );
  }
  return (
    <svg
      className="inline-block w-4 h-4 text-danger-hover"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// ─── Add Provider Form ────────────────────────────────────────────────────────

const PROVIDER_TYPES = [
  'PLEX',
  'JELLYFIN',
  'SONARR',
  'RADARR',
  'TAUTULLI',
  'OVERSEERR',
  'TMDB',
  'OMDB',
] as const;

interface AddFormState {
  type: string;
  name: string;
  url: string;
  apiKey: string;
  userId: string;
}

function AddProviderForm({
  onSubmit,
  onCancel,
}: { onSubmit: (params: CreateProviderParams) => void; onCancel: () => void }) {
  const [form, setForm] = useState<AddFormState>({
    type: 'RADARR',
    name: '',
    url: '',
    apiKey: '',
    userId: '',
  });
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | undefined>();
  const testAbortRef = useRef<AbortController | null>(null);

  const runTest = async (url: string, apiKey: string, type: string) => {
    if (!url) return;
    testAbortRef.current?.abort();
    const ac = new AbortController();
    testAbortRef.current = ac;

    setTestStatus('loading');
    setTestError(undefined);
    try {
      const params = new URLSearchParams({ type, url });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/settings/providers/test?${params}`, { signal: ac.signal });
      const json = await res.json();
      if (json.data?.ok) {
        setTestStatus('pass');
      } else {
        setTestStatus('fail');
        setTestError(json.data?.error ?? 'Connection failed');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setTestStatus('fail');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleBlur = () => {
    runTest(form.url, form.apiKey, form.type);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = API_SUFFIXES[form.type] ?? '';
    const host = form.url.replace(/\/+$/, '');
    const fullUrl = suffix ? `${host}${suffix}` : host;

    const settings = form.type === 'JELLYFIN' && form.userId ? { userId: form.userId } : undefined;

    onSubmit({
      type: form.type,
      name: form.name,
      url: fullUrl,
      apiKey: form.apiKey || undefined,
      settings,
    });
  };

  const resetTest = () => {
    setTestStatus('idle');
    setTestError(undefined);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 p-4 border border-border rounded-lg bg-surface-panel"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="add-type" className="block text-sm text-text-secondary mb-1">
            Type
          </label>
          <select
            id="add-type"
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value;
              const defaultUrl = PROVIDER_DEFAULT_URLS[newType];
              setForm((f) => ({ ...f, type: newType, url: defaultUrl ?? f.url }));
              resetTest();
            }}
            className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="add-name" className="block text-sm text-text-secondary mb-1">
            Name
          </label>
          <input
            id="add-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Radarr"
            className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
            required
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="add-url" className="block text-sm text-text-secondary mb-1">
            Host URL
            <span className="ml-2">
              <ConnectionIcon status={testStatus} />
            </span>
            {testError && <span className="ml-2 text-xs text-danger-hover">{testError}</span>}
          </label>
          {PROVIDER_DEFAULT_URLS[form.type] !== undefined ? (
            <input
              id="add-url"
              type="url"
              value={form.url}
              readOnly
              className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-muted cursor-not-allowed opacity-70"
            />
          ) : (
            <input
              id="add-url"
              type="url"
              value={form.url}
              onChange={(e) => {
                setForm((f) => ({ ...f, url: e.target.value }));
                resetTest();
              }}
              onBlur={handleBlur}
              placeholder="http://localhost:7878"
              className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
              required
            />
          )}
        </div>
        <div>
          <label htmlFor="add-apikey" className="block text-sm text-text-secondary mb-1">
            API Key
          </label>
          <input
            id="add-apikey"
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              setForm((f) => ({ ...f, apiKey: e.target.value }));
              resetTest();
            }}
            onBlur={handleBlur}
            placeholder="Optional"
            className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
          />
        </div>
        {form.type === 'JELLYFIN' && (
          <div>
            <label htmlFor="add-userid" className="block text-sm text-text-secondary mb-1">
              User ID
            </label>
            <input
              id="add-userid"
              type="text"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              placeholder="Jellyfin user ID"
              className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

// ─── Provider Row ─────────────────────────────────────────────────────────────

function stripSuffix(url: string, type: string): string {
  const suffix = API_SUFFIXES[type] ?? '';
  if (suffix && url.endsWith(suffix)) return url.slice(0, -suffix.length);
  return url;
}

interface EditFormState {
  name: string;
  url: string;
  apiKey: string;
  userId: string;
}

function ProviderRow({
  provider,
  onUpdate,
  onDelete,
}: {
  provider: ProviderSummary;
  onUpdate: (patch: UpdateProviderParams) => Promise<unknown>;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<EditFormState>({
    name: provider.name,
    url: stripSuffix(provider.url, provider.type),
    apiKey: '',
    userId: typeof provider.settings?.userId === 'string' ? provider.settings.userId : '',
  });
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | undefined>();
  const testAbortRef = useRef<AbortController | null>(null);

  const runTest = async (url: string, apiKey: string, type: string) => {
    if (!url) return;
    testAbortRef.current?.abort();
    const ac = new AbortController();
    testAbortRef.current = ac;
    setTestStatus('loading');
    setTestError(undefined);
    try {
      const params = new URLSearchParams({ type, url });
      if (apiKey) params.set('apiKey', apiKey);
      const res = await fetch(`/api/settings/providers/test?${params}`, { signal: ac.signal });
      const json = await res.json();
      if (json.data?.ok) {
        setTestStatus('pass');
      } else {
        setTestStatus('fail');
        setTestError(json.data?.error ?? 'Connection failed');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setTestStatus('fail');
      setTestError(err instanceof Error ? err.message : 'Connection failed');
    }
  };

  const handleBlur = () => runTest(form.url, form.apiKey, provider.type);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = API_SUFFIXES[provider.type] ?? '';
    const host = form.url.replace(/\/+$/, '');
    const fullUrl = suffix ? `${host}${suffix}` : host;

    const patch: UpdateProviderParams = { name: form.name, url: fullUrl };
    if (form.apiKey) patch.apiKey = form.apiKey;
    if (provider.type === 'JELLYFIN') patch.settings = { userId: form.userId };

    await onUpdate(patch);
    setEditing(false);
    setTestStatus('idle');
  };

  const handleCancel = () => {
    setForm({
      name: provider.name,
      url: stripSuffix(provider.url, provider.type),
      apiKey: '',
      userId: typeof provider.settings?.userId === 'string' ? provider.settings.userId : '',
    });
    setEditing(false);
    setTestStatus('idle');
    setTestError(undefined);
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between p-4 border border-border rounded-lg bg-surface-panel">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-text-primary">{provider.name}</span>
            <span className="text-xs px-2 py-0.5 bg-primary/20 text-primary rounded">
              {provider.type}
            </span>
            {!provider.isActive && (
              <span className="text-xs px-2 py-0.5 bg-danger/20 text-danger-hover rounded">
                Inactive
              </span>
            )}
          </div>
          <div className="text-sm text-text-secondary">{provider.url}</div>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
            aria-label={`Edit ${provider.name}`}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={onDelete}
            aria-label={`Delete ${provider.name}`}
          >
            Delete
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSave}
      className="p-4 border border-primary/40 rounded-lg bg-surface-panel space-y-4"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label
            htmlFor={`edit-${provider.id}-name`}
            className="block text-sm text-text-secondary mb-1"
          >
            Name
          </label>
          <input
            id={`edit-${provider.id}-name`}
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
            required
          />
        </div>
        <div>
          <label
            htmlFor={`edit-${provider.id}-url`}
            className="block text-sm text-text-secondary mb-1"
          >
            Host URL
            <span className="ml-2">
              <ConnectionIcon status={testStatus} />
            </span>
            {testError && <span className="ml-2 text-xs text-danger-hover">{testError}</span>}
          </label>
          <input
            id={`edit-${provider.id}-url`}
            type="url"
            value={form.url}
            onChange={(e) => {
              setForm((f) => ({ ...f, url: e.target.value }));
              setTestStatus('idle');
            }}
            onBlur={handleBlur}
            className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
            required
          />
        </div>
        <div>
          <label
            htmlFor={`edit-${provider.id}-apikey`}
            className="block text-sm text-text-secondary mb-1"
          >
            API Key <span className="text-xs opacity-60">(leave blank to keep existing)</span>
          </label>
          <input
            id={`edit-${provider.id}-apikey`}
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              setForm((f) => ({ ...f, apiKey: e.target.value }));
              setTestStatus('idle');
            }}
            onBlur={handleBlur}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
          />
        </div>
        {provider.type === 'JELLYFIN' && (
          <div>
            <label
              htmlFor={`edit-${provider.id}-userid`}
              className="block text-sm text-text-secondary mb-1"
            >
              User ID
            </label>
            <input
              id={`edit-${provider.id}-userid`}
              type="text"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              className="w-full px-3 py-2 bg-surface-bg border border-border rounded text-text-primary"
            />
          </div>
        )}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" size="sm">
          Save
        </Button>
      </div>
    </form>
  );
}

// ─── Auth guard ───────────────────────────────────────────────────────────────

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const authRedirect = await requireAuth(ctx);
  if (authRedirect) return authRedirect;
  return { props: {} };
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { providers, isLoading, create, update, remove } = useProviderSettings();
  const [showAddForm, setShowAddForm] = useState(false);

  const handleCreate = async (params: CreateProviderParams) => {
    await create(params);
    setShowAddForm(false);
  };

  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar
          title="Provider Settings"
          breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Settings' }]}
        />
      }
    >
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <Button type="button" variant="primary" onClick={() => setShowAddForm((v) => !v)}>
            Add Provider
          </Button>
        </div>

        {showAddForm && (
          <AddProviderForm onSubmit={handleCreate} onCancel={() => setShowAddForm(false)} />
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[68px]" />
            ))}
          </div>
        )}

        <div className="space-y-3">
          {providers?.map((p) => (
            <ProviderRow
              key={p.id}
              provider={p}
              onUpdate={(patch) => update(p.id, patch)}
              onDelete={() => remove(p.id)}
            />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
