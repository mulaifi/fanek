import type { NextApiRequest } from 'next';
import type { Session } from 'next-auth';

/** NextApiRequest with session attached by auth guard */
export interface AuthenticatedRequest extends NextApiRequest {
  session: Session;
}

/** Standard paginated list response */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}

/** Standard error response */
export interface ApiError {
  error: string;
  details?: unknown;
}
