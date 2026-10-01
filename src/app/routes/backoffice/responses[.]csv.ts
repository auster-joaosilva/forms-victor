import { createFileRoute } from '@tanstack/react-router'
import { responseBackoffice } from '@/server/diagnosis/composition'
import { isResponseStatus } from '@/server/diagnosis/domain/response-status'
import { getSessionUser } from '@/server/shared/http/session'

// The /backoffice beforeLoad does not run for server handlers, so the session is checked here.
export const Route = createFileRoute('/backoffice/responses.csv')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getSessionUser(request.headers)
        if (!user) return new Response('Acesso restrito.', { status: 401, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const file = await responseBackoffice.exportResponses(
          { id: user.id, username: user.username },
          { status: isResponseStatus(status) ? status : undefined, search: url.searchParams.get('q')?.slice(0, 200) ?? undefined },
        )
        return new Response(file.body, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${file.fileName}"`,
            'Cache-Control': 'no-store',
          },
        })
      },
    },
  },
})
