import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';
import { useMediaRules } from '../useMediaRules';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

describe('useMediaRules', () => {
  it('exposes the provider-gated rule descriptors projected by GET /api/filter-fields', async () => {
    server.use(
      http.get('/api/filter-fields', () =>
        HttpResponse.json([
          {
            key: 'year',
            label: 'Year',
            contentTypes: ['movie', 'show'],
            dataType: 'range',
            sourceProviders: ['RADARR', 'SONARR'],
            required: false,
          },
        ])
      )
    );

    const { result } = renderHook(() => useMediaRules(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rules).toEqual([
      expect.objectContaining({ key: 'year', dataType: 'range' }),
    ]);
  });

  it('scopes the request to a content type via the query string', async () => {
    server.use(
      http.get('/api/filter-fields', ({ request }) =>
        HttpResponse.json(
          new URL(request.url).searchParams.get('contentType') === 'movie'
            ? [
                {
                  key: 'tagIds',
                  label: 'Tags',
                  contentTypes: ['movie'],
                  dataType: 'csv-ids',
                  sourceProviders: ['RADARR'],
                  required: false,
                },
              ]
            : []
        )
      )
    );

    const { result } = renderHook(() => useMediaRules('movie'), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rules).toEqual([expect.objectContaining({ key: 'tagIds' })]);
  });
});
