import { useState } from 'react';
import Button from '@app/components/Button';
import styles from './RatingsForm.module.css';

export interface RatingsFormValues {
  title: string;
  year: number | undefined;
  tmdbApiKey: string;
  omdbApiKey: string;
}

interface RatingsFormProps {
  onSubmit: (values: RatingsFormValues) => void;
  isLoading?: boolean;
}

export default function RatingsForm({ onSubmit, isLoading = false }: RatingsFormProps) {
  const [title, setTitle] = useState('');
  const [year, setYear] = useState('');
  const [tmdbApiKey, setTmdbApiKey] = useState('');
  const [omdbApiKey, setOmdbApiKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title,
      year: year ? Number(year) : undefined,
      tmdbApiKey,
      omdbApiKey,
    });
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.infoBar}>
        <span className={styles.infoText}>TVMaze: always included (no key needed)</span>
      </div>

      <div className={styles.field}>
        <label htmlFor="ratings-title" className={styles.label}>
          Title
        </label>
        <input
          id="ratings-title"
          type="text"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Breaking Bad"
          required
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="ratings-year" className={styles.label}>
          Year
        </label>
        <input
          id="ratings-year"
          type="number"
          className={styles.input}
          value={year}
          onChange={(e) => setYear(e.target.value)}
          placeholder="e.g. 2008 (optional)"
          min="1900"
          max="2100"
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="ratings-tmdb-key" className={styles.label}>
          TMDB API Key
        </label>
        <input
          id="ratings-tmdb-key"
          type="text"
          className={styles.input}
          value={tmdbApiKey}
          onChange={(e) => setTmdbApiKey(e.target.value)}
          placeholder="Your TMDB API key"
        />
        <p className={styles.hint}>Optional - uses existing TMDB config if empty</p>
      </div>

      <div className={styles.field}>
        <label htmlFor="ratings-omdb-key" className={styles.label}>
          OMDB API Key
        </label>
        <input
          id="ratings-omdb-key"
          type="text"
          className={styles.input}
          value={omdbApiKey}
          onChange={(e) => setOmdbApiKey(e.target.value)}
          placeholder="Your OMDB API key"
        />
        <a
          href="https://www.omdbapi.com/apikey.aspx"
          className={styles.hintLink}
          target="_blank"
          rel="noopener noreferrer"
        >
          Optional - get free key
        </a>
      </div>

      <Button type="submit" variant="primary" size="md" loading={isLoading}>
        Fetch Ratings
      </Button>
    </form>
  );
}
