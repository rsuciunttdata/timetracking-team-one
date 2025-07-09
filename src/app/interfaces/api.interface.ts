/**
 * Common API interfaces and types
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message?: string;
  errors?: ApiError[];
  meta?: ApiMeta;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
}

export interface ApiMeta {
  page?: number;
  pageSize?: number;
  total?: number;
  totalPages?: number;
}

export interface PaginationRequest {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface LoadingState {
  isLoading: boolean;
  error?: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}
