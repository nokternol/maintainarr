import { useState } from 'react';
import { Card } from '@app/components/Card';
import Button from '@app/components/Button';
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

  // Provider-specific URL placeholders
  const urlPlaceholder = {
    SONARR: 'http://localhost:8989/api/v3',
    RADARR: 'http://localhost:7878/api/v3',
    PLEX: 'http://localhost:32400',
    JELLYFIN: 'http://localhost:8096',
    TAUTULLI: 'http://localhost:8181',
    OVERSEERR: 'http://localhost:5055',
  }[type];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params: FetchParams = { type, url, apiKey };
    if (needsSettings && settings) {
      params.settings = settings;
    }
    onFetch(params);
  };

  return (
    <Card variant="outlined">
      <Card.Header>
        <h2 className={styles.title}>{title}</h2>
      </Card.Header>

      <Card.Content divided>
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
              placeholder={urlPlaceholder}
            />
            {(type === 'SONARR' || type === 'RADARR') && (
              <p className={styles.hint}>Include /api/v3 in the URL</p>
            )}
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

          <Button type="submit" variant="primary" size="md" loading={isLoading}>
            Fetch Metadata
          </Button>
        </form>

        {error && <div className={styles.error}>{error}</div>}

        {data && !isLoading && (
          <div className={styles.results}>
            {Object.entries(data).map(([key, value]) => (
              <div key={key} className={styles.section}>
                <div className={styles.sectionTitle}>{key}</div>
                {Array.isArray(value) && value.length > 0 ? (
                  value.map((item, idx) => {
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
      </Card.Content>
    </Card>
  );
}
