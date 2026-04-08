import AppLayout from '@app/components/AppLayout';
import MediaCard from '@app/components/MediaCard';
import MediaGrid from '@app/components/MediaGrid';
import RatingsPanel from '@app/components/RatingsPanel';
import Sidebar from '@app/components/Sidebar';
import TopBar from '@app/components/TopBar';
import { useMedia } from '@app/hooks/useMedia';
import type { ManagedMovie, ManagedSeries } from '@app/hooks/useMedia';
import type { SidebarItem } from '@app/types/navigation';
import { useState } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const DashboardIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-label="Icon">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const MediaIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-label="Icon">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" role="img" aria-label="Icon">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const sidebarItems: SidebarItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, href: '/dashboard' },
  { id: 'media', label: 'Media', icon: <MediaIcon />, href: '/media', active: true },
  { id: 'search', label: 'Search', icon: <SearchIcon />, href: '/search' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getPosterUrl(images?: { coverType: string; remoteUrl: string }[]): string | undefined {
  return images?.find((img) => img.coverType === 'poster')?.remoteUrl;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface SelectedMedia {
  title: string;
  year?: number;
}

export default function MediaPage() {
  const { movies, series, isLoading } = useMedia();
  const [selected, setSelected] = useState<SelectedMedia | null>(null);

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
          title="Managed Media"
          breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Media' }]}
        />
      }
    >
      <div className="p-6 space-y-8">
        {/* Movies */}
        {((movies && movies.length > 0) || isLoading) && (
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Movies</h2>
            <MediaGrid
              items={movies ?? []}
              isLoading={isLoading && !movies}
              renderItem={(movie: ManagedMovie) => (
                <div
                  key={`movie-${movie.id}`}
                  data-testid={`media-card-movie-${movie.id}`}
                  onClick={() => setSelected({ title: movie.title, year: movie.year })}
                >
                  <MediaCard id={`movie-${movie.id}`}>
                    <MediaCard.Poster
                      src={getPosterUrl(movie.images)}
                      alt={movie.title}
                    />
                    <MediaCard.Content>
                      <MediaCard.Title>{movie.title}</MediaCard.Title>
                      <MediaCard.Year>{movie.year}</MediaCard.Year>
                      <MediaCard.StatusBadge
                        status={movie.hasFile ? 'downloaded' : 'missing'}
                      />
                    </MediaCard.Content>
                  </MediaCard>
                </div>
              )}
            />
          </section>
        )}

        {/* Series */}
        {((series && series.length > 0) || isLoading) && (
          <section>
            <h2 className="text-lg font-semibold text-text-primary mb-4">Series</h2>
            <MediaGrid
              items={series ?? []}
              isLoading={isLoading && !series}
              renderItem={(show: ManagedSeries) => (
                <MediaCard
                  key={`series-${show.id}`}
                  id={`series-${show.id}`}
                >
                  <MediaCard.Poster
                    src={getPosterUrl(show.images)}
                    alt={show.title}
                  />
                  <MediaCard.Content>
                    <MediaCard.Title>{show.title}</MediaCard.Title>
                    <MediaCard.Year>{show.year}</MediaCard.Year>
                    <MediaCard.StatusBadge
                      status={show.monitored ? 'monitored' : undefined}
                    />
                  </MediaCard.Content>
                </MediaCard>
              )}
            />
          </section>
        )}

        {!isLoading && !movies?.length && !series?.length && (
          <div className="text-text-secondary text-center py-16">
            No media found. Configure providers in Settings to scan your library.
          </div>
        )}
      </div>

      <RatingsPanel
        isOpen={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.title ?? ''}
        year={selected?.year}
      />
    </AppLayout>
  );
}
