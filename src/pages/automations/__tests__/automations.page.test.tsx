import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@tests/helpers/component';
import { MOCK_AUTOMATIONS } from '@tests/mocks/handlers/automations';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import AutomationsPage from '../index';

// Isolate SWR cache per test
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

describe('AutomationsPage', () => {
  it('shows error count badge when automations have lastRun.status === "error"', async () => {
    render(<AutomationsPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText(/1 error/i)).toBeInTheDocument();
    });
  });

  it('POSTs /:id/run when a Run-now control is clicked', async () => {
    let runUrl = '';
    server.use(
      http.post('/api/automations/:id/run', ({ request }) => {
        runUrl = request.url;
        return new HttpResponse(null, { status: 202 });
      })
    );

    render(<AutomationsPage />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Nightly cleanup')).toBeInTheDocument());

    await userEvent.click(screen.getAllByTitle('Run now')[0]);

    await waitFor(() =>
      expect(runUrl).toMatch(new RegExp(`/api/automations/${MOCK_AUTOMATIONS[0].id}/run$`))
    );
  });
});
