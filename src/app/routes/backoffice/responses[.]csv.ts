import { createFileRoute } from '@tanstack/react-router'
import { responseBackoffice } from '@/server/diagnosis/composition'
import { isResponseStatus } from '@/server/diagnosis/domain/response-status'
import { csvAttachment } from '@/server/shared/http/csv-response'
import { ensureCapability } from '@/server/shared/http/session-middleware'

// The /backoffice beforeLoad does not run for server handlers, so the capability is checked here.
export const Route = createFileRoute('/backoffice/responses.csv')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await ensureCapability(request, 'export_responses')
        if (user instanceof Response) return user
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const file = await responseBackoffice.exportResponses(
          { id: user.id, username: user.username },
          { status: isResponseStatus(status) ? status : undefined, search: url.searchParams.get('q')?.slice(0, 200) ?? undefined },
        )
        return csvAttachment(file.fileName, file.body)
      },
    },
  },
})
