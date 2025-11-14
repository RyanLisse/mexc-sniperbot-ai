/**
 * Standard API Response Interface
 *
 * This interface ensures consistent response format across all API routes
 */

export interface ApiResponse<T = unknown> {
  /** Indicates if the request was successful */
  success: boolean;
  /** Response status (healthy, warning, unhealthy, error) */
  status?:
    | "healthy"
    | "warning"
    | "unhealthy"
    | "error"
    | "pending"
    | "active"
    | "inactive";
  /** Human-readable message */
  message?: string;
  /** The actual response data */
  data?: T;
  /** Error message if the request failed */
  error?: string;
  /** Optional error details (for validation errors, etc.) */
  details?: Record<string, unknown>;
  /** Optional metadata like pagination, timestamps, etc. */
  meta?: {
    timestamp?: string;
    count?: number;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    version?: string;
    environment?: string;
    requestId?: string;
    statusCode?: number;
    errorCode?: string;
    cached?: boolean;
    executionTimeMs?: number;
    serviceLayer?: boolean;
    fallback?: boolean;
    [key: string]: unknown;
  };
  /** Compatibility alias for metadata */
  metadata?: {
    timestamp?: string;
    count?: number;
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    version?: string;
    environment?: string;
    requestId?: string;
    statusCode?: number;
    errorCode?: string;
    [key: string]: unknown;
  };
}

/**
 * Creates a successful API response
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: ApiResponse<T>["meta"]
): ApiResponse<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Creates an error API response
 */
export function createErrorResponse(
  error: string,
  meta?: ApiResponse["meta"]
): ApiResponse {
  return {
    success: false,
    error,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta,
    },
  };
}

/**
 * Helper to create paginated responses
 */
export function createPaginatedResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): ApiResponse<T[]> {
  return createSuccessResponse(data, {
    count: data.length,
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  });
}

/**
 * Response wrapper for Next.js API routes
 */
export function apiResponse<T>(response: ApiResponse<T>, status = 200) {
  const { NextResponse } = require("next/server");
  return NextResponse.json(response, { status });
}

// Add helper methods to apiResponse
apiResponse.success = <T>(
  data: T,
  meta?: ApiResponse<T>["meta"],
  status = 200
) => {
  const { NextResponse } = require("next/server");
  return NextResponse.json(createSuccessResponse(data, meta), { status });
};

apiResponse.error = (
  error: string,
  status = 500,
  details?: Record<string, unknown>
) => {
  const { NextResponse } = require("next/server");
  const response = createErrorResponse(error);
  if (details) {
    response.details = details;
  }
  return NextResponse.json(response, { status });
};

/**
 * Common HTTP status codes for API responses
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;
