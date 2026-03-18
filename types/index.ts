export type { User, Customer, Service, ServiceType, Partner, AuditLog, Settings, Role } from '@prisma/client';

export interface Contact {
  name: string;
  email?: string;
  phone?: string;
  role?: string;
}

export interface FieldSchema {
  name: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'currency' | 'boolean';
  required: boolean;
  options?: string[];
}

export interface ApiError {
  error: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AuthProviderConfig {
  google?: { clientId: string; clientSecret: string };
  azure?: { clientId: string; clientSecret: string; tenantId: string };
  [key: string]: unknown;
}
