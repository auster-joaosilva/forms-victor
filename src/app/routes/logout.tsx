import { createFileRoute, redirect } from '@tanstack/react-router'
import { signOutCurrentUser } from '@/features/auth/api/session'

export const Route = createFileRoute('/logout')({
  beforeLoad: async () => {
    await signOutCurrentUser()
    throw redirect({ to: '/login' })
  },
})
