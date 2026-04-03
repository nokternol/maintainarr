import styles from './ProviderTestResult.module.css';

interface ProviderTestResultProps {
  isLoading?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export default function ProviderTestResult({ isLoading, error, data }: ProviderTestResultProps) {
  if (!isLoading && !error && !data) {
    return null;
  }

  return (
    <div className={styles.container}>
      {error && <div className={styles.error}>{error}</div>}

      {isLoading && <div className={styles.loading}>Loading...</div>}

      {data && !isLoading && (
        <div className={styles.results}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className={styles.section}>
              <div className={styles.sectionTitle}>{key}</div>
              {Array.isArray(value) && value.length > 0 ? (
                value.map((item, idx) => {
                  const itemKey =
                    typeof item === 'object' && item !== null && 'id' in item
                      ? `${key}-${(item as { id: unknown }).id}`
                      : `${key}-${idx}`;
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
