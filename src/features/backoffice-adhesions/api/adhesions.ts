import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { adhesionBackoffice } from '@/server/adhesion/composition'
import { ADHESION_STATUSES } from '@/server/adhesion/domain/adhesion'
import { requireCapability } from '@/server/shared/http/session-middleware'

export type { AdhesionList, AdhesionSummary } from '@/server/adhesion/composition'

const filterInput = z.object({
  status: z.enum(ADHESION_STATUSES).optional(),
  modality: z.enum(['padrao', 'hibrido']).optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
})
const idInput = z.object({ id: z.number().int().positive() })

export const listAdhesionsFn = createServerFn({ method: 'GET' })
  .middleware([requireCapability('view_adhesions')])
  .inputValidator(filterInput)
  .handler(({ data }) => adhesionBackoffice.list(data))

export const handleAdhesionFn = createServerFn({ method: 'POST' })
  .middleware([requireCapability('handle_adhesions')])
  .inputValidator(idInput.extend({ status: z.enum(ADHESION_STATUSES) }))
  .handler(({ data, context }) => adhesionBackoffice.handle({ id: context.session.user.id, username: context.session.user.username }, data))

export const getAdhesionTermFn = createServerFn({ method: 'GET' })
  .middleware([requireCapability('reprint_term')])
  .inputValidator(idInput)
  .handler(({ data }) => adhesionBackoffice.termCopy(data.id))
