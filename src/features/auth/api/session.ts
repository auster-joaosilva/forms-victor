import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { getSessionUser, signOut } from '@/server/shared/http/session'

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(() => getSessionUser(getRequest().headers))

export const signOutCurrentUser = createServerFn({ method: 'POST' }).handler(async () => {
  await signOut(getRequest().headers)
})
