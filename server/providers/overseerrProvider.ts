import { MetadataProviderType } from '../database/schema';
import { decorate } from '../jobs/enrichment/decorate';
import { mapOverseerr } from '../jobs/enrichment/mappers';
import { BaseProviderConnection } from './baseProviderConnection';
import type { EnrichmentResult, MediaEnricher, MediaItem } from './roles';

export interface OverseerrRequestedBy {
  id: number;
  displayName: string;
  email: string;
}

export interface OverseerrMedia {
  tmdbId: number;
  title: string;
}

export interface OverseerrRequest {
  id: number;
  status: number;
  type: string;
  requestedBy: OverseerrRequestedBy;
  media: OverseerrMedia;
  createdAt: string;
}

interface OverseerrRequestsResponse {
  results: OverseerrRequest[];
  pageInfo: {
    pages: number;
    pageSize: number;
    results: number;
    page: number;
  };
}

export interface OverseerrIssue {
  id: number;
  status: number;
  media: { tmdbId: number };
}

export interface OverseerrSearchResult {
  id: number;
  mediaType: string;
  title?: string;
  name?: string;
  overview?: string;
  mediaInfo?: unknown;
}

interface OverseerrSearchResponse {
  results: OverseerrSearchResult[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export class OverseerrProvider extends BaseProviderConnection implements MediaEnricher {
  async enrich(items: MediaItem[]): Promise<EnrichmentResult> {
    const [requests, issues] = await Promise.all([this.getRequests(), this.getIssues()]);
    const fieldsByKey = mapOverseerr(requests, issues);
    return {
      provider: MetadataProviderType.OVERSEERR,
      items: decorate(items, (i) => i._sourceIds.tmdb, fieldsByKey),
    };
  }

  private get authHeader() {
    return { 'X-Api-Key': this.provider.apiKey ?? '' };
  }

  public async getRequests(): Promise<OverseerrRequest[]> {
    const resp = await this.client
      .get('api/v1/request', { headers: this.authHeader })
      .json<OverseerrRequestsResponse>();
    return resp.results;
  }

  public async getIssues(): Promise<OverseerrIssue[]> {
    const resp = await this.client
      .get('api/v1/issue', { headers: this.authHeader })
      .json<{ results: OverseerrIssue[] }>();
    return resp.results;
  }

  public async search(query: string): Promise<OverseerrSearchResult[]> {
    // overseerr rejects + and expects %20
    const encodedQuery = encodeURIComponent(query);
    const resp = await this.client
      .get(`api/v1/search?query=${encodedQuery}`, {
        headers: this.authHeader,
      })
      .json<OverseerrSearchResponse>();
    return resp.results;
  }
}
