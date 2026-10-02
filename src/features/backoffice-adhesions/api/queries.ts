import { queryOptions } from '@tanstack/react-query'
import type { AdhesionStatus, Modality } from '@/server/adhesion/domain/adhesion'
import { listAdhesionsFn } from './adhesions'

export type AdhesionsFilter = { status?: AdhesionStatus; modality?: Modality; q?: string; page: number }

export const adhesionsQuery = (filter: AdhesionsFilter) =>
  queryOptions({
    queryKey: ['adhesions', filter],
    queryFn: () => listAdhesionsFn({ data: { status: filter.status, modality: filter.modality, search: filter.q, page: filter.page } }),
  })
