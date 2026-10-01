import { queryOptions } from '@tanstack/react-query'
import type { ResponseStatus } from '@/server/diagnosis/domain/response-status'
import { getResponseFn, listResponsesFn } from './responses'

export type ResponsesFilter = { status?: ResponseStatus; q?: string; page: number }

export const responsesQuery = (filter: ResponsesFilter) =>
  queryOptions({ queryKey: ['responses', filter], queryFn: () => listResponsesFn({ data: { status: filter.status, search: filter.q, page: filter.page } }) })

export const responseQuery = (id: number) =>
  queryOptions({ queryKey: ['responses', 'detail', id], queryFn: () => getResponseFn({ data: { id } }) })
