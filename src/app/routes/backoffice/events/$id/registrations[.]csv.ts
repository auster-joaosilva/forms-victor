import { createFileRoute } from '@tanstack/react-router'
import { eventBackoffice } from '@/server/events/composition'
import { isRegistrationStatus } from '@/server/events/domain/event'
import { csvAttachment } from '@/server/shared/http/csv-response'
import { ensureCapability } from '@/server/shared/http/route-capability'

const positive = (value: string | null | undefined) => (value && /^\d{1,9}$/.test(value) && Number(value) > 0 ? Number(value) : undefined)
const notFound = () => new Response('Evento não encontrado.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

// O beforeLoad de /backoffice não roda para server handlers, então a permissão é conferida aqui.
export const Route = createFileRoute('/backoffice/events/$id/registrations.csv')({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const user = await ensureCapability(request, 'export_registrations')
        if (user instanceof Response) return user
        const eventId = positive(params.id)
        if (!eventId) return notFound()
        const url = new URL(request.url)
        const status = url.searchParams.get('situacao')
        const file = await eventBackoffice.exportCsv({ id: user.id, username: user.username }, eventId, {
          sessionId: positive(url.searchParams.get('sessao')),
          status: isRegistrationStatus(status) ? status : undefined,
          search: url.searchParams.get('busca')?.slice(0, 200) || undefined,
        })
        return file ? csvAttachment(file.fileName, file.body) : notFound()
      },
    },
  },
})
