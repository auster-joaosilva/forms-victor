import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '@/server/shared/auth/auth'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(async () => {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session || session.user.banned) return null
  return {
    id: session.user.id,
    username: session.user.username ?? '',
    name: session.user.name,
    role: session.user.role === 'admin' ? ('admin' as const) : ('team' as const),
  }
})

export const signOutCurrentUser = createServerFn({ method: 'POST' }).handler(async () => {
  await auth.api.signOut({ headers: getRequest().headers })
})
