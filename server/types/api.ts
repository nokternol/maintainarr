/** Standardized API response envelope for successful responses. */
export interface ApiSuccessResponse<T = unknown> {
  status: 'ok';
  data: T;
}

/** Standardized API response envelope for error responses. */
export interface ApiErrorResponse {
  status: 'error';
  error: {
    type: string;
    message: string;
    errors?: Record<string, string[]>;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
