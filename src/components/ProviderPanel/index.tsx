import { useState } from 'react';
import styles from './ProviderPanel.module.css';

type ProviderType = 'SONARR' | 'RADARR' | 'PLEX' | 'JELLYFIN' | 'TAUTULLI' | 'OVERSEERR';

interface FetchParams {
  type: ProviderType;
  url: string;
  apiKey: string;
  settings?: string;
}

interface ProviderPanelProps {
  title: string;
  type: ProviderType;
  onFetch: (params: FetchParams) => void;
  isLoading?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export default function ProviderPanel({
  title,
  type,
  onFetch,
  isLoading = false,
  error,
  data,
}: ProviderPanelProps) {
  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [settings, setSettings] = useState('');

  const needsSettings = type === 'JELLYFIN';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: FetchParams = {
      type,
      url,
      apiKey,
    };
    if (needsSettings && settings) {
      params.settings = settings;
    }
    onFetch(params);
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>{title}</h2>

      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor={`${type}-url`} className={styles.label}>
            URL
          </label>
          <input
            id={`${type}-url`}
            type="text"
            className={styles.input}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="http://localhost:8989"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor={`${type}-apiKey`} className={styles.label}>
            API Key
          </label>
          <input
            id={`${type}-apiKey`}
            type="text"
            className={styles.input}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Your API key"
          />
        </div>

        {needsSettings && (
          <div className={styles.field}>
            <label htmlFor={`${type}-settings`} className={styles.label}>
              Settings (JSON)
            </label>
            <textarea
              id={`${type}-settings`}
              className={styles.textarea}
              value={settings}
              onChange={(e) => setSettings(e.target.value)}
              placeholder='{"userId":"abc123"}'
            />
          </div>
        )}

        <button type="submit" className={styles.button} disabled={isLoading}>
          {isLoading ? 'Loading...' : 'Fetch Metadata'}
        </button>
      </form>

      {isLoading && <div className={styles.loading}>Loading...</div>}

      {error && <div className={styles.error}>{error}</div>}

      {data && !isLoading && (
        <div className={styles.results}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className={styles.section}>
              <div className={styles.sectionTitle}>{key}</div>
              {Array.isArray(value) && value.length > 0 ? (
                value.map((item, idx) => {
                  // Use item.id if available, otherwise fall back to stringified item + index
                  const itemKey =
                    typeof item === 'object' && item !== null && 'id' in item
                      ? `${key}-${item.id}`
                      : `${key}-${idx}-${JSON.stringify(item)}`;
                  return (
                    <div key={itemKey} className={styles.row}>
                      {JSON.stringify(item)}
                    </div>
                  );
                })
              ) : (
                <div className={styles.row}>No data</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
