import { createMiddleware, createStart } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { resolveLegacyRedirect } from './app/legacy-redirects'
import { withSecurityHeaders } from './app/security-headers'

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
  try {
    const result = await next()
    const response = withSecurityHeaders(result.response)
    return response === result.response ? result : response
  } catch (error) {
    if (error instanceof Response) return withSecurityHeaders(error)
    console.error(error)
    return withSecurityHeaders(new Response('Erro interno.', { status: 500 }))
  }
})

export const startInstance = createStart(() => ({ requestMiddleware: [securityHeaders, bodyLimit, legacyRedirects] }))
