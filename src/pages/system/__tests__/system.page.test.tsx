import type { AutomationDto } from '@app/hooks/useAutomations';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@tests/helpers/component';
import { server } from '@tests/mocks/server';
import { http, HttpResponse } from 'msw';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import SystemPage from '../index';

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ provider: () => new Map() }}>{children}</SWRConfig>
);

const SYSTEM_AUTOMATIONS: AutomationDto[] = [
  {
    id: 101,
    name: 'Identity Resolution',
    kind: 'system',
    query: null,
    provider: null,
    querySources: [],
    taskId: 'system:identity-resolution',
    schedule: '0 */6 * * *',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
  {
    id: 102,
    name: 'Enrichment',
    kind: 'system',
    query: null,
    provider: null,
    querySources: [],
    taskId: 'system:enrichment',
    schedule: '0 3 * * *',
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  },
];

function useSystemList() {
  server.use(
    http.get('/api/automations', ({ request }) => {
      const kind = new URL(request.url).searchParams.get('kind');
      const data = kind === 'system' ? SYSTEM_AUTOMATIONS : [];
      return HttpResponse.json({ status: 'ok', data });
    })
  );
}

describe('SystemPage', () => {
  it('lists the seeded system automations each with a Run-now control', async () => {
    useSystemList();

    render(<SystemPage />, { wrapper: Wrapper });

    await waitFor(() => expect(screen.getByText('Identity Resolution')).toBeInTheDocument());
    expect(screen.getByText('Enrichment')).toBeInTheDocument();
    expect(screen.getAllByTitle('Run now')).toHaveLength(2);
  });

  it('POSTs /:id/run when a Run-now control is clicked', async () => {
    useSystemList();
    let runUrl = '';
    server.use(
      http.post('/api/automations/:id/run', ({ request }) => {
        runUrl = request.url;
        return new HttpResponse(null, { status: 202 });
      })
    );

    render(<SystemPage />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByText('Identity Resolution')).toBeInTheDocument());

    await userEvent.click(screen.getAllByTitle('Run now')[0]);

    await waitFor(() => expect(runUrl).toMatch(/\/api\/automations\/101\/run$/));
  });
});
