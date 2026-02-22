import AppLayout from '@app/components/AppLayout';
import RatingsDisplay from '@app/components/RatingsDisplay';
import type { AggregatedRatings } from '@app/components/RatingsDisplay';
import RatingsForm from '@app/components/RatingsForm';
import type { RatingsFormValues } from '@app/components/RatingsForm';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { useRatings } from '@app/hooks/useRatings';
import type { SidebarItem } from '@app/types/navigation';
import { useState } from 'react';
import styles from './ratings.module.css';

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

const ProviderIcon = () => (
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

const StarIcon = () => (
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
      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
    />
  </svg>
);

// ─── Navigation ───────────────────────────────────────────────────────────────

const sidebarItems: SidebarItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <DashboardIcon />,
    href: '/dashboard',
  },
  {
    id: 'providers',
    label: 'Providers',
    icon: <ProviderIcon />,
    href: '/providers',
  },
  {
    id: 'ratings',
    label: 'Ratings',
    icon: <StarIcon />,
    href: '/ratings',
    active: true,
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function RatingsPage() {
  const { trigger, isLoading } = useRatings();
  const [ratings, setRatings] = useState<AggregatedRatings | null>(null);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (values: RatingsFormValues) => {
    setError(undefined);
    setRatings(null);

    try {
      const data = await trigger({
        title: values.title,
        year: values.year,
        tmdbApiKey: values.tmdbApiKey || undefined,
        omdbApiKey: values.omdbApiKey || undefined,
      });
      if (data) {
        setRatings(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch ratings');
    }
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
          title="Ratings"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Ratings' }]}
        />
      }
    >
      <div className={styles.page}>
        {/* Instructions */}
        <div className={styles.instructions}>
          <h2 className={styles.instructionsTitle}>Ratings Sources</h2>
          <ul className={styles.instructionsList}>
            <li>
              <strong>TVMaze</strong> — always included, no API key required
            </li>
            <li>
              <strong>TMDB</strong> — uses your existing config if API key is left blank
            </li>
            <li>
              <strong>OMDB</strong> — provides IMDb, Rotten Tomatoes &amp; Metacritic scores.{' '}
              <a
                href="https://www.omdbapi.com/apikey.aspx"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.link}
              >
                Get a free key →
              </a>
            </li>
          </ul>
        </div>

        {/* Form */}
        <div className={styles.formPanel}>
          <h3 className={styles.panelTitle}>Fetch Ratings</h3>
          <RatingsForm onSubmit={handleSubmit} isLoading={isLoading} />
        </div>

        {/* Error */}
        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {/* Results */}
        {ratings && <RatingsDisplay ratings={ratings} />}
      </div>
    </AppLayout>
  );
}
