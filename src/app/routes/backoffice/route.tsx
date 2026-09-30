import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUser } from '@/features/auth/api/session'

export const Route = createFileRoute('/backoffice')({
  beforeLoad: async ({ location }) => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login', search: { redirect: location.href } })
    return { user }
  },
  component: Outlet,
})
