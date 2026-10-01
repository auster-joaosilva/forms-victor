import { createFileRoute } from '@tanstack/react-router'
import { adhesionBackoffice } from '@/server/adhesion/composition'
import { ADHESION_STATUSES, type AdhesionStatus, type Modality } from '@/server/adhesion/domain/adhesion'
import { csvAttachment } from '@/server/shared/http/csv-response'
import { ensureCapability } from '@/server/shared/http/session-middleware'

const isStatus = (value: string | null): value is AdhesionStatus => ADHESION_STATUSES.some((status) => status === value)
const isModality = (value: string | null): value is Modality => value === 'padrao' || value === 'hibrido'

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
            status: isStatus(status) ? status : undefined,
            modality: isModality(modality) ? modality : undefined,
            search: url.searchParams.get('q')?.slice(0, 200) ?? undefined,
          },
        )
        return csvAttachment(file.fileName, file.body)
      },
    },
  },
})
