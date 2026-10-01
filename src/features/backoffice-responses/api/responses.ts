import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { diagnosisReports, responseBackoffice } from '@/server/diagnosis/composition'
import { RESPONSE_STATUSES } from '@/server/diagnosis/domain/response-status'
import { sessionMiddleware } from '@/server/shared/http/session-middleware'

export type { ResponseDetail, ResponseList, ResponseSummary } from '@/server/diagnosis/composition'

const filterInput = z.object({
  status: z.enum(RESPONSE_STATUSES).optional(),
  search: z.string().max(200).optional(),
  page: z.number().int().min(1).max(10_000).optional(),
})
const idInput = z.object({ id: z.number().int().positive() })

export const listResponsesFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .inputValidator(filterInput)
  .handler(({ data }) => responseBackoffice.listResponses(data))

export const getResponseFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .inputValidator(idInput)
  .handler(({ data }) => responseBackoffice.getResponse(data.id))

export const handleResponseFn = createServerFn({ method: 'POST' })
  .middleware([sessionMiddleware])
  .inputValidator(idInput.extend({ status: z.enum(RESPONSE_STATUSES).nullable(), note: z.string().max(5000) }))
  .handler(({ data, context }) => responseBackoffice.handleResponse({ id: context.session.user.id, username: context.session.user.username }, data))

export const getResponseReportFn = createServerFn({ method: 'GET' })
  .middleware([sessionMiddleware])
  .inputValidator(idInput)
  .handler(({ data }) => diagnosisReports.responseReport(data.id))
