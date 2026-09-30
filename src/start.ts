import { createMiddleware, createStart } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { resolveLegacyRedirect } from './app/legacy-redirects'

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'X-Robots-Tag': 'noindex, nofollow',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
}

const MAX_BODY_BYTES = 256 * 1024

const bodyLimit = createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
  const length = request.headers.get('content-length')
  if (length === null) {
    if (request.headers.has('transfer-encoding')) return new Response('Envie o corpo com Content-Length.', { status: 411 })
  } else if (!/^\d+$/.test(length)) {
    return new Response('Content-Length inválido.', { status: 400 })
  } else if (Number(length) > MAX_BODY_BYTES) {
    return new Response('Corpo da requisição grande demais.', { status: 413 })
  }
  return next()
})

const legacyRedirects = createMiddleware({ type: 'request' }).server(async ({ request, next }) => {
  const target = resolveLegacyRedirect(new URL(request.url))
  if (target) throw redirect({ href: target, statusCode: 301 })
  return next()
})

const securityHeaders = createMiddleware({ type: 'request' }).server(async ({ next }) => {
  const result = await next()
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) result.response.headers.set(name, value)
  return result
})

export const startInstance = createStart(() => ({ requestMiddleware: [securityHeaders, bodyLimit, legacyRedirects] }))
