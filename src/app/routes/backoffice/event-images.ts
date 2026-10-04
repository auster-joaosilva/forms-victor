import { createFileRoute } from '@tanstack/react-router'
import { eventBackoffice } from '@/server/events/composition'
import { ensureCapability } from '@/server/shared/http/route-capability'

const KINDS: readonly string[] = ['event_cover', 'speaker_photo']

// Not a server function: the cover exceeds the 256 KiB body limit; only this route gets 6 MiB (src/app/body-limit.ts).
// The /backoffice beforeLoad does not run for server handlers, so the capability is checked here.
export const Route = createFileRoute('/backoffice/event-images')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await ensureCapability(request, 'manage_events')
        if (user instanceof Response) return user
        const url = new URL(request.url)
        const kind = url.searchParams.get('kind') ?? ''
        if (!KINDS.includes(kind)) return Response.json({ error: 'tipo de imagem inválido' }, { status: 400 })
        const bytes = new Uint8Array(await request.arrayBuffer())
        const contentType = (request.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? ''
        const name = url.searchParams.get('name')?.slice(0, 200) || null
        const result = await eventBackoffice.uploadImage({ id: user.id, username: user.username }, kind, bytes, contentType, name)
        return result.ok ? Response.json({ fileId: result.fileId }) : Response.json({ error: result.error }, { status: 400 })
      },
    },
  },
})
