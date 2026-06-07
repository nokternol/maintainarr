import {
  AutomationSchema,
  CreateAutomationInputSchema,
  CreateSavedQueryInputSchema,
  SavedQuerySchema,
  UpdateAutomationStatusInputSchema,
} from '@app/lib/api/schemas';
import { MOCK_AUTOMATIONS, MOCK_SAVED_QUERIES } from '@tests/mocks/handlers/automations';
import { describe, expect, it } from 'vitest';

// ─── Response shape contracts ─────────────────────────────────────────────────
// Each mock item must parse cleanly — fails if a mock drifts from the schema.

describe('API contracts — MSW mock data', () => {
  describe('GET /api/saved-queries', () => {
    it.each(MOCK_SAVED_QUERIES)('item $name parses against SavedQuerySchema', (item) => {
      const result = SavedQuerySchema.safeParse(item);
      expect(result.success, JSON.stringify(result.error?.format())).toBe(true);
    });
  });

  describe('GET /api/automations', () => {
    it.each(MOCK_AUTOMATIONS)('item $name parses against AutomationSchema', (item) => {
      const result = AutomationSchema.safeParse(item);
      expect(result.success, JSON.stringify(result.error?.format())).toBe(true);
    });
  });
});

// ─── Input shape contracts ─────────────────────────────────────────────────────
// The body each client hook sends must satisfy the server's input schema.
// These fail if useSavedQueries/useAutomations sends a shape the server rejects.

describe('API contracts — client request bodies', () => {
  it('POST /api/saved-queries body is valid', () => {
    const body: unknown = {
      name: 'Unwatched movies',
      contentType: 'movie',
      filterValues: [{ key: 'watched', value: false }],
    };
    const result = CreateSavedQueryInputSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.error?.format())).toBe(true);
  });

  it('POST /api/automations body is valid', () => {
    const body: unknown = {
      name: 'Nightly cleanup',
      queryId: 1,
      providerId: 1,
      taskId: 'radarr.deleteUnmonitored',
      schedule: '0 2 * * *',
    };
    const result = CreateAutomationInputSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.error?.format())).toBe(true);
  });

  it('PATCH /api/automations/:id/status body is valid', () => {
    const body: unknown = { status: 'paused' };
    const result = UpdateAutomationStatusInputSchema.safeParse(body);
    expect(result.success, JSON.stringify(result.error?.format())).toBe(true);
  });
});
