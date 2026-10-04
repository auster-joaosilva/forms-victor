import { createFileRoute } from '@tanstack/react-router'
import { findHousePhoto, readFile } from '@/server/storage/composition'

// O mesmo molde do portal antigo: sem ponto nem barra antes da extensão, o nome nunca vira caminho para outro lugar.
const HOUSE_PHOTO_NAME = /^[a-z0-9_-]+\.(jpg|png|svg|webp)$/

const notFound = () => new Response('Imagem não encontrada.', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })

export const Route = createFileRoute('/imagens/$name')({
  server: {
    handlers: {
      GET: async ({ params }) => {
        if (!HOUSE_PHOTO_NAME.test(params.name)) return notFound()
        const record = await findHousePhoto(params.name)
        if (!record) return notFound()
        const found = await readFile(record.id)
        if (!found) return notFound()
        return new Response(found.body as BodyInit, {
          headers: {
            'Content-Type': found.file.contentType,
            'Content-Length': String(found.file.size),
            'Cache-Control': 'public, max-age=86400',
            'X-Content-Type-Options': 'nosniff',
          },
        })
      },
    },
  },
})
