const STATIC_PATHS: Record<string, string> = {
  '/index.html': '/',
  '/principal': '/',
  '/diagnostico-simples': '/diagnosis',
  '/diagnóstico-simples': '/diagnosis',
  '/adesao': '/adhesion',
  '/eventos': '/events',
  '/entrar': '/login',
  '/sair': '/logout',
  '/saude': '/health',
}

function withInvite(target: string, search: URLSearchParams): string {
  const params = new URLSearchParams(search)
  const invite = params.get('c')
  params.delete('c')
  if (invite) params.set('invite', invite)
  const query = params.toString()
  return query ? `${target}?${query}` : target
}

export function resolveLegacyRedirect(url: URL): string | null {
  let path: string
  try {
    path = decodeURIComponent(url.pathname).replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
  const lower = path.toLowerCase()
  if (path === '/' && url.searchParams.has('c')) return withInvite('/diagnosis', url.searchParams)
  if (STATIC_PATHS[lower]) return withInvite(STATIC_PATHS[lower], url.searchParams)
  if (lower.startsWith('/eventos/')) return `/events/${encodeURIComponent(path.slice('/eventos/'.length))}`
  const id = url.searchParams.get('id')
  if (lower === '/backoffice/relatorio' && id && /^\d+$/.test(id)) return `/backoffice/responses/${id}/report`
  if (lower === '/backoffice/termo' && id && /^\d+$/.test(id)) return `/backoffice/adhesions/${id}/term`
  return null
}
