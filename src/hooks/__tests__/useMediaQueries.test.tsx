import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import React from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';
import { server } from '../../../tests/mocks/server';
import { toFilterValues, useMediaQueries } from '../useMediaQueries';

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(SWRConfig, { value: { provider: () => new Map() } }, children);

describe('toFilterValues', () => {
  it('emits registry-keyed entries directly, no rename table', () => {
    expect(toFilterValues({ tagIds: '1,2', hasFile: true })).toEqual([
      { key: 'tagIds', value: '1,2' },
      { key: 'hasFile', value: true },
    ]);
  });

  it('drops undefined values rather than persisting them', () => {
    expect(toFilterValues({ title: undefined, tagIds: '1,2' })).toEqual([
      { key: 'tagIds', value: '1,2' },
    ]);
  });

  it('passes range values through untouched', () => {
    expect(toFilterValues({ year: { min: 2000, max: 2020 } })).toEqual([
      { key: 'year', value: { min: 2000, max: 2020 } },
    ]);
  });
});

describe('useMediaQueries — save', () => {
  it('posts registry-keyed filterValues for the given contentType, no translation', async () => {
    let body: unknown;
    server.use(
      http.post('/api/media-queries', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          data: { id: 1, name: 'My query', contentType: 'movie', filterValues: [], health: 'ok' },
        });
      }),
      http.get('/api/media-queries', () => HttpResponse.json({ data: [] }))
    );

    const { result } = renderHook(() => useMediaQueries(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.save('My query', 'movie', [
      { key: 'tagIds', value: '1,2' },
      { key: 'hasFile', value: true },
    ]);

    expect(body).toEqual({
      name: 'My query',
      contentType: 'movie',
      filterValues: [
        { key: 'tagIds', value: '1,2' },
        { key: 'hasFile', value: true },
      ],
    });
  });

  it('posts a providerId qualification through untouched', async () => {
    let body: unknown;
    server.use(
      http.post('/api/media-queries', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          data: { id: 1, name: 'My query', contentType: 'movie', filterValues: [], health: 'ok' },
        });
      }),
      http.get('/api/media-queries', () => HttpResponse.json({ data: [] }))
    );

    const { result } = renderHook(() => useMediaQueries(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await result.current.save('4k query', 'movie', [
      { key: 'qualityProfileIds', value: '5', providerId: 3 },
    ]);

    expect(body).toEqual({
      name: '4k query',
      contentType: 'movie',
      filterValues: [{ key: 'qualityProfileIds', value: '5', providerId: 3 }],
    });
  });
});
