import { auth } from '../auth/auth'
import { CLIENT_IP_HEADER, requestOrigin } from './request-origin'

export type SessionUser = { id: string; username: string; name: string; role: 'admin' | 'team' }

export async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers })
  if (!session || session.user.banned) return null
  return {
    id: session.user.id,
    username: session.user.username ?? '',
    name: session.user.name,
    role: session.user.role === 'admin' ? 'admin' : 'team',
  }
}

export async function signOut(headers: Headers): Promise<void> {
  await auth.api.signOut({ headers })
}

export async function authHandler(request: Request): Promise<Response> {
  const headers = new Headers(request.headers)
  headers.delete(CLIENT_IP_HEADER)
  const { ip } = requestOrigin(request.headers)
  if (ip) headers.set(CLIENT_IP_HEADER, ip)
  // O Request do srvx não é o do undici: new Request(request, init) quebra em produção.
  const body = request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer()
  return auth.handler(new Request(request.url, { method: request.method, headers, body, signal: request.signal }))
}
