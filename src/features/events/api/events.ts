import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { lookupCompany } from '@/server/company-lookup/composition'
import { publicBaseUrl, publicEvents, registerForSession } from '@/server/events/composition'
import { brasiliaDateParts } from '@/server/shared/domain/dates'
import { requestOrigin } from '@/server/shared/http/request-origin'
import { getSessionUser } from '@/server/shared/http/session'
import type { EventPageBootstrap, EventsListBootstrap, SubmitRegistrationWire } from '../types/events'
import { guardRegistration } from './guard-submit'
import { isEventSlug, loadEventPageInput, lookupRegistrationCompanyInput, submitRegistrationInput } from './schemas'

// O hoje da contagem regressiva é o dia de Brasília no servidor, não o relógio de quem visita.
function todayInBrasilia(): string {
  const { year, month, day } = brasiliaDateParts(new Date())
  return `${year}-${month}-${day}`
}

export const loadEventsList = createServerFn({ method: 'GET' }).handler(
  async (): Promise<EventsListBootstrap> => ({ events: await publicEvents.list(), today: todayInBrasilia(), publicUrl: publicBaseUrl }),
)

// Rascunho só abre para quem tem sessão no backoffice com view_events; para os outros é 404.
export const loadEventPage = createServerFn({ method: 'GET' })
  .inputValidator(loadEventPageInput)
  .handler(async ({ data }): Promise<EventPageBootstrap | null> => {
    if (!isEventSlug(data.slug)) return null
    const user = await getSessionUser(getRequest().headers)
    const event = await publicEvents.page(data.slug, { canViewDrafts: user?.capabilities.includes('view_events') ?? false })
    return event ? { event, today: todayInBrasilia(), publicUrl: publicBaseUrl } : null
  })

// Só a razão social sai daqui: o QSA e o resto do cadastro ficam no servidor.
export const lookupRegistrationCompany = createServerFn({ method: 'POST' })
  .inputValidator(lookupRegistrationCompanyInput)
  .handler(async ({ data }): Promise<{ companyName: string | null }> => {
    const result = await lookupCompany({ cnpj: data.cnpj })
    return { companyName: result.ok ? result.company.legalName : null }
  })

export const submitRegistration = createServerFn({ method: 'POST' })
  .inputValidator(submitRegistrationInput)
  .handler(async ({ data }): Promise<SubmitRegistrationWire> => {
    const headers = getRequest().headers
    return guardRegistration(() => registerForSession({ body: data, origin: requestOrigin(headers), userAgent: headers.get('user-agent') }))
  })
