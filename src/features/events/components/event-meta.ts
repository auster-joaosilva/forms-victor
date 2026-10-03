import type { EventView } from '@/server/events/domain/event'

type Meta = { title: string } | { name: string; content: string } | { property: string; content: string }

// Prévia no WhatsApp: sem isto o link chega sem título nem descrição. O robots fica com o X-Robots-Tag global.
function previewMeta(title: string, description: string, url: string | null): Meta[] {
  return [
    { title },
    { name: 'description', content: description },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: 'Auster Inteligência Contábil' },
    { property: 'og:locale', content: 'pt_BR' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    ...(url ? [{ property: 'og:url', content: url }] : []),
    { name: 'twitter:card', content: 'summary' },
  ]
}

export const eventMeta = (event: EventView, publicUrl: string) =>
  previewMeta(
    `${event.title} — Auster Inteligência Contábil`,
    event.content.chamada || 'Inscrição gratuita.',
    publicUrl ? `${publicUrl}/events/${encodeURIComponent(event.slug)}` : null,
  )

export const listMeta = (publicUrl: string) =>
  previewMeta(
    'Eventos — Auster Inteligência Contábil',
    'Encontros da Auster sobre a Reforma Tributária. Inscrição gratuita.',
    publicUrl ? `${publicUrl}/events` : null,
  )
