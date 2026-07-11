import '@testing-library/jest-dom/vitest';
import { render, screen, setupUser, waitFor } from '@tests/helpers/component';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import MediaPage from '../index';

// Isolate SWR cache per test
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('MediaPage', () => {
  it('renders the page title', () => {
    render(<MediaPage />, { wrapper: Wrapper });
    expect(screen.getByText(/managed media/i)).toBeInTheDocument();
  });

  it('renders AppLayout with sidebar', () => {
    const { container } = render(<MediaPage />, { wrapper: Wrapper });
    expect(container.querySelector('aside')).toBeInTheDocument();
  });

  it('shows skeleton cards while both sections are loading', () => {
    render(<MediaPage />, { wrapper: Wrapper });
    // VirtualMediaGrid renders skeletonCount (48) cards per section while isLoading
    const skeletons = screen.getAllByTestId('media-card-skeleton');
    expect(skeletons.length).toBeGreaterThanOrEqual(48);
  });

  it('shows movie titles after loading', async () => {
    render(<MediaPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Movie 1')).toBeInTheDocument();
    });
  });

  it('shows series titles after loading', async () => {
    render(<MediaPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText('Breaking Bad')).toBeInTheDocument();
    });
  });

  it('opens RatingsPanel when a movie card is clicked', async () => {
    const user = setupUser();
    render(<MediaPage />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Movie 1')).toBeInTheDocument());
    await user.click(screen.getByTestId('media-card-movie-1'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows empty library message on movies tab when movies API returns empty', async () => {
    server.use(
      http.get('/api/media/movies', () =>
        HttpResponse.json({
          status: 'ok',
          data: { items: [], totalCount: 0, page: 1, pageSize: 48 },
        })
      ),
      http.get('/api/media/series', () =>
        HttpResponse.json({
          status: 'ok',
          data: { items: [], totalCount: 0, page: 1, pageSize: 48 },
        })
      )
    );
    render(<MediaPage />, { wrapper: Wrapper });
    // Active tab defaults to 'movies'; default provider mock has RADARR active
    await waitFor(() => {
      expect(screen.getByText(/your movie library is empty/i)).toBeInTheDocument();
    });
  });

  it('derives empty-state gating and provider name from the ownership projection', async () => {
    // Settings still report an active RADARR — the projection, not the client's
    // own provider-type constant, must decide the empty state and its copy.
    server.use(
      http.get('/api/media/sources', () =>
        HttpResponse.json({
          status: 'ok',
          data: [
            { contentType: 'movie', ownerType: 'JELLYFIN', configured: false, instances: [] },
            { contentType: 'show', ownerType: 'SONARR', configured: false, instances: [] },
          ],
        })
      ),
      http.get('/api/media/movies', () =>
        HttpResponse.json({
          status: 'ok',
          data: { items: [], totalCount: 0, page: 1, pageSize: 48 },
        })
      )
    );
    render(<MediaPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText(/no jellyfin connection configured/i)).toBeInTheDocument();
    });
  });

  it('shows no-provider message on movies tab when the movie owner is not configured', async () => {
    server.use(
      http.get('/api/media/sources', () =>
        HttpResponse.json({
          status: 'ok',
          data: [
            { contentType: 'movie', ownerType: 'RADARR', configured: false, instances: [] },
            { contentType: 'show', ownerType: 'SONARR', configured: false, instances: [] },
          ],
        })
      ),
      http.get('/api/media/movies', () =>
        HttpResponse.json({
          status: 'ok',
          data: { items: [], totalCount: 0, page: 1, pageSize: 48 },
        })
      )
    );
    render(<MediaPage />, { wrapper: Wrapper });
    await waitFor(() => {
      expect(screen.getByText(/no radarr connection configured/i)).toBeInTheDocument();
    });
  });
});
