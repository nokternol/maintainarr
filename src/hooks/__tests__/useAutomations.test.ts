import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';
import { type AutomationDto, useAutomations } from '../useAutomations';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

const makeAutomation = (overrides: Partial<AutomationDto> = {}): AutomationDto => ({
  id: 1,
  name: 'Test Automation',
  query: { id: 1, name: 'My Query', contentType: 'movie' as const },
  provider: { id: 1, name: 'Radarr', type: 'RADARR' },
  taskId: 'delete-movie',
  schedule: '0 * * * *',
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  ...overrides,
});

describe('useAutomations — network call count', () => {
  it('create fires exactly one network request (POST, no subsequent GET)', async () => {
    const requests: string[] = [];
    const newAutomation = makeAutomation({ id: 2, name: 'New' });

    server.use(
      http.get('/api/automations', ({ request }) => {
        requests.push(`GET ${request.url}`);
        return HttpResponse.json({ data: [] });
      }),
      http.post('/api/automations', ({ request }) => {
        requests.push(`POST ${request.url}`);
        return HttpResponse.json({ data: newAutomation });
      })
    );

    const { result } = renderHook(() => useAutomations(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Clear the initial GET from mount
    requests.length = 0;

    await act(async () => {
      await result.current.create({
        name: 'New',
        queryId: 1,
        providerId: 1,
        taskId: 'delete-movie',
        schedule: '0 * * * *',
      });
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^POST/);
  });

  it('setStatus fires exactly one network request (PATCH, no subsequent GET)', async () => {
    const requests: string[] = [];
    const existing = makeAutomation({ id: 1, status: 'active' });
    const updated = makeAutomation({ id: 1, status: 'paused' });

    server.use(
      http.get('/api/automations', ({ request }) => {
        requests.push(`GET ${request.url}`);
        return HttpResponse.json({ data: [existing] });
      }),
      http.patch('/api/automations/1/status', ({ request }) => {
        requests.push(`PATCH ${request.url}`);
        return HttpResponse.json({ data: updated });
      })
    );

    const { result } = renderHook(() => useAutomations(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Clear the initial GET from mount
    requests.length = 0;

    await act(async () => {
      await result.current.setStatus(1, 'paused');
    });

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatch(/^PATCH/);
  });

  it('remove fires two network requests (DELETE then GET refetch)', async () => {
    const requests: string[] = [];
    const existing = makeAutomation({ id: 1 });

    server.use(
      http.get('/api/automations', ({ request }) => {
        requests.push(`GET ${request.url}`);
        return HttpResponse.json({ data: [existing] });
      }),
      http.delete('/api/automations/1', ({ request }) => {
        requests.push(`DELETE ${request.url}`);
        return HttpResponse.json({});
      })
    );

    const { result } = renderHook(() => useAutomations(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Clear the initial GET from mount
    requests.length = 0;

    await act(async () => {
      await result.current.remove(1);
    });

    expect(requests).toHaveLength(2);
    expect(requests[0]).toMatch(/^DELETE/);
    expect(requests[1]).toMatch(/^GET/);
  });
});
