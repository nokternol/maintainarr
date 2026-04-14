import { BaseMetadataProvider } from './baseMetadataProvider';

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

export class OverseerrProvider extends BaseMetadataProvider {
  private get authHeader() {
    return { 'X-Api-Key': this.provider.apiKey ?? '' };
  }

  public async getRequests(): Promise<OverseerrRequest[]> {
    const resp = await this.client
      .get('api/v1/request', { headers: this.authHeader })
      .json<OverseerrRequestsResponse>();
    return resp.results;
  }

  public async search(query: string): Promise<OverseerrSearchResult[]> {
    const resp = await this.client
      .get('api/v1/search', { headers: this.authHeader, searchParams: { query } })
      .json<OverseerrSearchResponse>();
    return resp.results;
  }
}
