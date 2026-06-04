import { render, screen, waitFor } from '@tests/helpers/component';
import { server } from '@tests/mocks/server';
import { MOCK_AUTOMATIONS } from '@tests/mocks/handlers/automations';
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
});
