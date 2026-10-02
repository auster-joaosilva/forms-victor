import { createFileRoute } from '@tanstack/react-router'
import { adhesionBackoffice } from '@/server/adhesion/composition'
import { isAdhesionStatus, isModality } from '@/server/adhesion/domain/adhesion'
import { csvAttachment } from '@/server/shared/http/csv-response'
import { ensureCapability } from '@/server/shared/http/route-capability'

// The /backoffice beforeLoad does not run for server handlers, so the capability is checked here.
export const Route = createFileRoute('/backoffice/adhesions.csv')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await ensureCapability(request, 'export_adhesions')
        if (user instanceof Response) return user
        const url = new URL(request.url)
        const status = url.searchParams.get('status')
        const modality = url.searchParams.get('modality')
        const file = await adhesionBackoffice.exportCsv(
          { id: user.id, username: user.username },
          {
            status: isAdhesionStatus(status) ? status : undefined,
            modality: isModality(modality) ? modality : undefined,
            search: url.searchParams.get('q')?.slice(0, 200) ?? undefined,
          },
        )
        return csvAttachment(file.fileName, file.body)
      },
    },
  },
})
