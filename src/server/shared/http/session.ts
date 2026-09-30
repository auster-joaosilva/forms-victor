import { auth } from '../auth/auth'

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

export const authHandler = (request: Request): Promise<Response> => auth.handler(request)
