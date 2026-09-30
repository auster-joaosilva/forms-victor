import { createFileRoute } from '@tanstack/react-router'
import { readFile } from '@/server/storage/composition'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export const Route = createFileRoute('/files/$fileId')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!uuid.test(params.fileId)) return new Response('Arquivo não encontrado.', { status: 404 })
        const found = await readFile(params.fileId)
        if (!found) return new Response('Arquivo não encontrado.', { status: 404 })
        return new Response(found.body as BodyInit, {
          headers: {
            'Content-Type': found.file.contentType,
            'Content-Length': String(found.file.size),
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
