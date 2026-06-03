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
import { PROVIDER_TASKS } from '@app/lib/tasks';
import { cn } from '@app/lib/utils/cn';
import { requireAuth } from '@app/lib/utils/requireAuth';
import {
  Activity,
  BarChart2,
  Bell,
  ChevronDown,
  ChevronUp,
  Clapperboard,
  Database,
  Film,
  Play,
  Plug,
  Star,
  TriangleAlert,
  Tv,
} from 'lucide-react';
import type { GetServerSideProps } from 'next';
import { useRef, useState } from 'react';

// ─── API suffix / URL maps ─────────────────────────────────────────────────────

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

const PROVIDER_DEFAULT_URLS: Partial<Record<string, string>> = {
  TMDB: 'https://api.themoviedb.org/3',
  OMDB: 'http://www.omdbapi.com',
};

// ─── Provider capability catalog (imported from shared lib) ──────────────────

const PROVIDER_FILTER_DATA: Record<string, string[]> = {
  PLEX: ['Library contents', 'Item metadata'],
  JELLYFIN: ['Library contents', 'Item metadata'],
  RADARR: ['Movie library', 'Quality profiles', 'Tags'],
  SONARR: ['Series library', 'Quality profiles', 'Tags'],
  TAUTULLI: ['Watch history', 'Play statistics', 'User activity'],
  OVERSEERR: ['Request queue'],
  TMDB: ['Ratings', 'Metadata'],
  OMDB: ['Ratings', 'Metadata'],
};

// ─── Provider grouping ────────────────────────────────────────────────────────

const GROUP_ORDER = [
  'PLEX',
  'JELLYFIN',
  'RADARR',
  'SONARR',
  'TAUTULLI',
  'OVERSEERR',
  'TMDB',
  'OMDB',
];

function sortProviders(providers: ProviderSummary[]): ProviderSummary[] {
  return [...providers].sort((a, b) => {
    const ai = GROUP_ORDER.indexOf(a.type);
    const bi = GROUP_ORDER.indexOf(b.type);
    const aIdx = ai === -1 ? 999 : ai;
    const bIdx = bi === -1 ? 999 : bi;
    return aIdx !== bIdx ? aIdx - bIdx : a.name.localeCompare(b.name);
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDefaultEnabledTasks(type: string): string[] {
  return (PROVIDER_TASKS[type] ?? []).filter((t) => !t.destructive).map((t) => t.id);
}

function getEnabledTasks(provider: ProviderSummary): string[] {
  const stored = provider.settings?.enabledTasks;
  if (Array.isArray(stored)) return stored as string[];
  return getDefaultEnabledTasks(provider.type);
}

function stripSuffix(url: string, type: string): string {
  const suffix = API_SUFFIXES[type] ?? '';
  if (suffix && url.endsWith(suffix)) return url.slice(0, -suffix.length);
  return url;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
}

function Toggle({ checked, onChange, disabled = false, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg focus-visible:outline-none',
        checked ? 'bg-primary' : 'bg-surface-elevated',
        disabled && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 rounded-full bg-white shadow-sm transform transition-transform duration-150',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

// ─── ConnectionTestIcon ───────────────────────────────────────────────────────

type TestStatus = 'idle' | 'loading' | 'pass' | 'fail';

function ConnectionTestIcon({ status }: { status: TestStatus }) {
  if (status === 'idle') return null;
  if (status === 'loading') {
    return (
      <svg
        className="inline-block w-4 h-4 animate-spin text-text-muted"
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

// ─── ProviderTypeIcon ─────────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, React.ReactNode> = {
  PLEX: <Play size={15} strokeWidth={1.75} />,
  JELLYFIN: <Film size={15} strokeWidth={1.75} />,
  RADARR: <Clapperboard size={15} strokeWidth={1.75} />,
  SONARR: <Tv size={15} strokeWidth={1.75} />,
  TAUTULLI: <BarChart2 size={15} strokeWidth={1.75} />,
  OVERSEERR: <Bell size={15} strokeWidth={1.75} />,
  TMDB: <Star size={15} strokeWidth={1.75} />,
  OMDB: <Database size={15} strokeWidth={1.75} />,
};

function ProviderTypeIcon({ type }: { type: string }) {
  return (
    <div className="w-8 h-8 rounded flex items-center justify-center bg-surface-elevated text-text-secondary shrink-0">
      {TYPE_ICONS[type] ?? <Plug size={15} strokeWidth={1.75} />}
    </div>
  );
}

// ─── StatusIndicator ──────────────────────────────────────────────────────────

function StatusIndicator({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs font-medium',
        isActive ? 'text-success' : 'text-text-muted'
      )}
    >
      <span
        className={cn(
          'inline-block w-1.5 h-1.5 rounded-full',
          isActive ? 'bg-success' : 'bg-text-muted'
        )}
      />
      {isActive ? 'Connected' : 'Inactive'}
    </span>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────

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

interface EditFormState {
  name: string;
  url: string;
  apiKey: string;
  userId: string;
}

interface ProviderCardProps {
  provider: ProviderSummary;
  onUpdate: (patch: UpdateProviderParams) => Promise<unknown>;
  onDelete: () => void;
}

function ProviderCard({ provider, onUpdate, onDelete }: ProviderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [editForm, setEditForm] = useState<EditFormState>({
    name: provider.name,
    url: stripSuffix(provider.url, provider.type),
    apiKey: '',
    userId: typeof provider.settings?.userId === 'string' ? provider.settings.userId : '',
  });
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testError, setTestError] = useState<string | undefined>();
  const testAbortRef = useRef<AbortController | null>(null);

  const [localEnabledTasks, setLocalEnabledTasks] = useState<string[] | null>(null);
  const [taskToggleLoading, setTaskToggleLoading] = useState<string | null>(null);
  const [taskToggleError, setTaskToggleError] = useState<string | null>(null);

  const enabledTasks = localEnabledTasks ?? getEnabledTasks(provider);
  const allTasks = PROVIDER_TASKS[provider.type] ?? [];
  const filterData = PROVIDER_FILTER_DATA[provider.type] ?? [];
  const hasTasks = allTasks.length > 0;

  const runTest = async (url: string, apiKey: string) => {
    if (!url) return;
    testAbortRef.current?.abort();
    const ac = new AbortController();
    testAbortRef.current = ac;
    setTestStatus('loading');
    setTestError(undefined);
    try {
      const params = new URLSearchParams({ type: provider.type, url });
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const suffix = API_SUFFIXES[provider.type] ?? '';
    const host = editForm.url.replace(/\/+$/, '');
    const fullUrl = suffix ? `${host}${suffix}` : host;

    const patch: UpdateProviderParams = { name: editForm.name, url: fullUrl };
    if (editForm.apiKey) patch.apiKey = editForm.apiKey;
    if (provider.type === 'JELLYFIN') {
      patch.settings = { ...(provider.settings ?? {}), userId: editForm.userId };
    }

    await onUpdate(patch);
    setEditing(false);
    setTestStatus('idle');
    setTestError(undefined);
  };

  const handleCancelEdit = () => {
    setEditForm({
      name: provider.name,
      url: stripSuffix(provider.url, provider.type),
      apiKey: '',
      userId: typeof provider.settings?.userId === 'string' ? provider.settings.userId : '',
    });
    setEditing(false);
    setTestStatus('idle');
    setTestError(undefined);
  };

  const handleTaskToggle = async (taskId: string, enabled: boolean) => {
    const current = localEnabledTasks ?? getEnabledTasks(provider);
    const next = enabled ? [...current, taskId] : current.filter((id) => id !== taskId);

    setLocalEnabledTasks(next);
    setTaskToggleLoading(taskId);
    setTaskToggleError(null);
    try {
      await onUpdate({
        settings: {
          ...(provider.settings ?? {}),
          enabledTasks: next,
        },
      });
    } catch {
      setLocalEnabledTasks(current);
      setTaskToggleError('Failed to save — try again.');
    } finally {
      setTaskToggleLoading(null);
    }
  };

  const capabilitySummary = (() => {
    const parts: string[] = [];
    if (filterData.length > 0) {
      const labels = filterData.slice(0, 2).join(' · ');
      parts.push(`Filter: ${labels}${filterData.length > 2 ? ' +more' : ''}`);
    }
    if (hasTasks) {
      parts.push(`Tasks: ${enabledTasks.length} of ${allTasks.length} enabled`);
    }
    return parts.join('  ·  ');
  })();

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors duration-150',
        expanded
          ? 'border-primary/30 bg-surface-panel'
          : 'border-border bg-surface-panel hover:border-border/80'
      )}
    >
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => {
          setExpanded((v) => !v);
          if (expanded) {
            setEditing(false);
            setConfirming(false);
          }
        }}
        className="w-full flex items-start gap-3 p-4 text-left focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg focus-visible:outline-none rounded-lg"
        aria-expanded={expanded}
      >
        <ProviderTypeIcon type={provider.type} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-text-primary">{provider.name}</span>
            <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
              {provider.type}
            </span>
            <StatusIndicator isActive={provider.isActive} />
          </div>
          <div className="text-xs text-text-muted mt-0.5 truncate">{provider.url}</div>
          {capabilitySummary && (
            <div className="text-xs text-text-muted mt-1">{capabilitySummary}</div>
          )}
        </div>

        <div className="shrink-0 text-text-muted mt-1">
          {expanded ? (
            <ChevronUp size={16} strokeWidth={1.75} />
          ) : (
            <ChevronDown size={16} strokeWidth={1.75} />
          )}
        </div>
      </button>

      {/* ─── Expanded content ─────────────────────────────────────────────── */}
      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-4">
          {/* Connection section */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">
                Connection
              </span>
              {!editing && !confirming && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg focus-visible:outline-none rounded"
                >
                  Edit
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor={`edit-${provider.id}-name`}
                      className="block text-xs text-text-secondary mb-1"
                    >
                      Name
                    </label>
                    <input
                      id={`edit-${provider.id}-name`}
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`edit-${provider.id}-url`}
                      className="block text-xs text-text-secondary mb-1"
                    >
                      Host URL
                      <span className="ml-1.5">
                        <ConnectionTestIcon status={testStatus} />
                      </span>
                      {testError && <span className="ml-1.5 text-danger-hover">{testError}</span>}
                    </label>
                    <input
                      id={`edit-${provider.id}-url`}
                      type="url"
                      value={editForm.url}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, url: e.target.value }));
                        setTestStatus('idle');
                      }}
                      onBlur={() => runTest(editForm.url, editForm.apiKey)}
                      className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label
                      htmlFor={`edit-${provider.id}-apikey`}
                      className="block text-xs text-text-secondary mb-1"
                    >
                      API Key <span className="opacity-50">(leave blank to keep existing)</span>
                    </label>
                    <input
                      id={`edit-${provider.id}-apikey`}
                      type="password"
                      value={editForm.apiKey}
                      onChange={(e) => {
                        setEditForm((f) => ({ ...f, apiKey: e.target.value }));
                        setTestStatus('idle');
                      }}
                      onBlur={() => runTest(editForm.url, editForm.apiKey)}
                      placeholder="••••••••"
                      className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
                    />
                  </div>
                  {provider.type === 'JELLYFIN' && (
                    <div>
                      <label
                        htmlFor={`edit-${provider.id}-userid`}
                        className="block text-xs text-text-secondary mb-1"
                      >
                        User ID
                      </label>
                      <input
                        id={`edit-${provider.id}-userid`}
                        type="text"
                        value={editForm.userId}
                        onChange={(e) => setEditForm((f) => ({ ...f, userId: e.target.value }))}
                        className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
                      />
                    </div>
                  )}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button type="button" variant="secondary" size="sm" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => runTest(editForm.url, editForm.apiKey)}
                  >
                    Test connection
                  </Button>
                  <Button type="submit" variant="primary" size="sm">
                    Save
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-0.5">
                <div className="text-sm text-text-secondary">{provider.url}</div>
                {provider.apiKey && (
                  <div className="text-xs text-text-muted">API key configured</div>
                )}
                {provider.type === 'JELLYFIN' && typeof provider.settings?.userId === 'string' && (
                  <div className="text-xs text-text-muted">User ID: {provider.settings.userId}</div>
                )}
              </div>
            )}
          </section>

          {/* Capabilities section */}
          {!editing && (
            <>
              {/* Filter data */}
              {filterData.length > 0 && (
                <section>
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    Filter data
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {filterData.map((label) => (
                      <span
                        key={label}
                        className="text-xs px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Available tasks */}
              {hasTasks && (
                <section>
                  <div className="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">
                    Available tasks
                  </div>
                  <div className="space-y-0">
                    {allTasks.map((task, idx) => {
                      const isEnabled = enabledTasks.includes(task.id);
                      const isLoading = taskToggleLoading === task.id;
                      return (
                        <div
                          key={task.id}
                          className={cn(
                            'flex items-start gap-3 py-2.5',
                            idx < allTasks.length - 1 && 'border-b border-border/40'
                          )}
                        >
                          <Toggle
                            checked={isEnabled}
                            onChange={(v) => handleTaskToggle(task.id, v)}
                            disabled={isLoading}
                            label={`${isEnabled ? 'Disable' : 'Enable'} "${task.label}"`}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={cn(
                                  'text-sm font-medium',
                                  isEnabled ? 'text-text-primary' : 'text-text-muted'
                                )}
                              >
                                {task.label}
                              </span>
                              {task.destructive && (
                                <TriangleAlert
                                  size={13}
                                  strokeWidth={1.75}
                                  className="text-warning shrink-0"
                                  aria-label="Destructive action"
                                />
                              )}
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">{task.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {taskToggleError && (
                    <p className="text-xs text-danger-hover mt-2">{taskToggleError}</p>
                  )}
                </section>
              )}

              {/* Delete / confirm */}
              <section className="pt-1">
                {confirming ? (
                  <div className="flex items-start gap-3 p-3 rounded bg-danger/5 border border-danger/20">
                    <div className="flex-1">
                      <p className="text-sm text-text-primary">
                        Delete <span className="font-medium">{provider.name}</span>? All associated
                        task configurations will be removed.
                      </p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => setConfirming(false)}
                      >
                        Cancel
                      </Button>
                      <Button type="button" variant="danger" size="sm" onClick={onDelete}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirming(true)}
                    className="text-xs text-text-muted hover:text-danger-hover transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-bg focus-visible:outline-none rounded"
                  >
                    Delete provider
                  </button>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Add Provider Form ────────────────────────────────────────────────────────

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
}: {
  onSubmit: (params: CreateProviderParams) => void;
  onCancel: () => void;
}) {
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

  return (
    <form
      onSubmit={handleSubmit}
      className="p-4 border border-primary/30 rounded-lg bg-surface-panel space-y-4"
    >
      <div className="text-sm font-medium text-text-primary">Add provider</div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="add-type" className="block text-xs text-text-secondary mb-1">
            Type
          </label>
          <select
            id="add-type"
            value={form.type}
            onChange={(e) => {
              const newType = e.target.value;
              const defaultUrl = PROVIDER_DEFAULT_URLS[newType];
              setForm((f) => ({ ...f, type: newType, url: defaultUrl ?? f.url }));
              setTestStatus('idle');
              setTestError(undefined);
            }}
            className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
          >
            {PROVIDER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="add-name" className="block text-xs text-text-secondary mb-1">
            Name
          </label>
          <input
            id="add-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="My Radarr"
            className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
            required
          />
        </div>
        <div className="col-span-2">
          <label htmlFor="add-url" className="block text-xs text-text-secondary mb-1">
            Host URL
            <span className="ml-1.5">
              <ConnectionTestIcon status={testStatus} />
            </span>
            {testError && <span className="ml-1.5 text-xs text-danger-hover">{testError}</span>}
          </label>
          {PROVIDER_DEFAULT_URLS[form.type] !== undefined ? (
            <input
              id="add-url"
              type="url"
              value={form.url}
              readOnly
              className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-muted cursor-not-allowed opacity-70"
            />
          ) : (
            <input
              id="add-url"
              type="url"
              value={form.url}
              onChange={(e) => {
                setForm((f) => ({ ...f, url: e.target.value }));
                setTestStatus('idle');
              }}
              onBlur={() => runTest(form.url, form.apiKey, form.type)}
              placeholder="http://localhost:7878"
              className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
              required
            />
          )}
        </div>
        <div>
          <label htmlFor="add-apikey" className="block text-xs text-text-secondary mb-1">
            API Key
          </label>
          <input
            id="add-apikey"
            type="password"
            value={form.apiKey}
            onChange={(e) => {
              setForm((f) => ({ ...f, apiKey: e.target.value }));
              setTestStatus('idle');
            }}
            onBlur={() => runTest(form.url, form.apiKey, form.type)}
            placeholder="Optional"
            className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
          />
        </div>
        {form.type === 'JELLYFIN' && (
          <div>
            <label htmlFor="add-userid" className="block text-xs text-text-secondary mb-1">
              User ID
            </label>
            <input
              id="add-userid"
              type="text"
              value={form.userId}
              onChange={(e) => setForm((f) => ({ ...f, userId: e.target.value }))}
              placeholder="Jellyfin user ID"
              className="w-full px-3 py-1.5 text-sm bg-surface-bg border border-border rounded text-text-primary focus:border-primary focus:outline-none transition-colors"
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

  const sorted = providers ? sortProviders(providers) : [];

  return (
    <AppLayout
      sidebar={<SidebarNav />}
      topBar={
        <TopBar
          title="Providers"
          breadcrumbs={[{ label: 'Settings' }, { label: 'Providers' }]}
          actions={
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setShowAddForm((v) => !v)}
            >
              Add provider
            </Button>
          }
        />
      }
    >
      <div className="p-6 space-y-4 max-w-3xl">
        {showAddForm && (
          <AddProviderForm onSubmit={handleCreate} onCancel={() => setShowAddForm(false)} />
        )}

        {isLoading && (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[72px]" />
            ))}
          </div>
        )}

        {!isLoading && sorted.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Plug size={32} strokeWidth={1.25} className="text-text-muted mb-4" />
            <p className="text-sm font-medium text-text-primary mb-1">No providers configured</p>
            <p className="text-xs text-text-muted max-w-xs">
              Connect your first provider to start building automations.
            </p>
          </div>
        )}

        {!isLoading && sorted.length > 0 && (
          <div className="space-y-2">
            {sorted.map((p, idx) => {
              const prev = idx > 0 ? sorted[idx - 1] : null;
              const typeGroup = (t: string) => GROUP_ORDER.indexOf(t);
              const showDivider = prev !== null && typeGroup(p.type) !== typeGroup(prev.type);

              return (
                <div key={p.id}>
                  {showDivider && <div className="h-px bg-border/40 my-1" />}
                  <ProviderCard
                    provider={p}
                    onUpdate={(patch) => update(p.id, patch)}
                    onDelete={() => remove(p.id)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
