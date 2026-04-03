import Button from '@app/components/Button';
import { Card } from '@app/components/Card';
import { useState } from 'react';
import styles from './ProviderForm.module.css';

export type ProviderFormType =
  | 'SONARR'
  | 'RADARR'
  | 'PLEX'
  | 'JELLYFIN'
  | 'TAUTULLI'
  | 'OVERSEERR'
  | 'TMDB'
  | 'OMDB';

export interface ProviderFormParams {
  type: ProviderFormType;
  url: string;
  apiKey: string;
  settings?: string;
}

interface ProviderFormProps {
  title: string;
  type: ProviderFormType;
  initialValues?: { url?: string; apiKey?: string; settings?: string };
  onTest: (params: ProviderFormParams) => void;
  onSave?: (params: ProviderFormParams) => void;
  isSaved?: boolean;
  isLoading?: boolean;
}

const urlPlaceholders: Record<ProviderFormType, string> = {
  SONARR: 'http://localhost:8989/api/v3',
  RADARR: 'http://localhost:7878/api/v3',
  PLEX: 'http://localhost:32400',
  JELLYFIN: 'http://localhost:8096',
  TAUTULLI: 'http://localhost:8181',
  OVERSEERR: 'http://localhost:5055',
  TMDB: 'https://api.themoviedb.org/3',
  OMDB: 'https://www.omdbapi.com',
};

export default function ProviderForm({
  title,
  type,
  initialValues,
  onTest,
  onSave,
  isSaved = false,
  isLoading = false,
}: ProviderFormProps) {
  const [url, setUrl] = useState(initialValues?.url ?? '');
  const [apiKey, setApiKey] = useState(initialValues?.apiKey ?? '');
  const [settings, setSettings] = useState(initialValues?.settings ?? '');

  const needsSettings = type === 'JELLYFIN';

  const buildParams = (): ProviderFormParams => {
    const params: ProviderFormParams = { type, url, apiKey };
    if (needsSettings && settings) {
      params.settings = settings;
    }
    return params;
  };

  return (
    <Card variant="outlined">
      <Card.Header>
        <h2 className={styles.title}>{title}</h2>
      </Card.Header>
      <Card.Content divided>
        <div className={styles.form}>
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
              placeholder={urlPlaceholders[type]}
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

          <div className={styles.actions}>
            <Button
              type="button"
              variant="secondary"
              size="md"
              loading={isLoading}
              onClick={() => onTest(buildParams())}
            >
              Test Connection
            </Button>
            {onSave && (
              <Button type="button" variant="primary" size="md" onClick={() => onSave(buildParams())}>
                Save
              </Button>
            )}
          </div>

          {isSaved && <p className={styles.savedConfirmation}>Saved</p>}
        </div>
      </Card.Content>
    </Card>
  );
}
