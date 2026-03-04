export interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  meta?: PaginationMeta
}

export interface PaginationMeta {
  total: number
  page: number
  limit: number
}
