const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const normalizeSlug = (raw: string): string => String(raw ?? '').trim().toLowerCase()

// O endereço vai para o WhatsApp: acento e espaço viram %C3%A7 quando alguém copia o link.
export function slugFrom(title: string, taken: ReadonlySet<string>): string {
  const base = String(title ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50) || 'evento'
  let slug = base
  for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`
  return slug
}

export function checkSlug(slug: string, takenByOthers: ReadonlySet<string>): string | null {
  const clean = normalizeSlug(slug)
  if (!clean) return 'o endereço não pode ficar em branco'
  if (!SLUG.test(clean)) return 'o endereço aceita só letras sem acento, números e hífen entre palavras'
  if (clean.length < 3 || clean.length > 50) return 'o endereço tem de ter de 3 a 50 caracteres'
  if (takenByOthers.has(clean)) return `já existe um evento em /eventos/${clean}`
  return null
}
