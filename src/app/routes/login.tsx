import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { getCurrentUser } from '@/features/auth/api/session'
import { LoginForm } from '@/features/auth/components/login-form'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ redirect: z.string().regex(/^\/backoffice(\/|\?|$)/).optional().catch(undefined) }),
  beforeLoad: async ({ search }) => {
    if (await getCurrentUser()) throw redirect({ to: search.redirect ?? '/backoffice' })
  },
  head: () => ({ meta: [{ title: 'Entrar — Conferência do Diagnóstico' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { redirect: target } = Route.useSearch()
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9] p-6">
      <LoginForm redirectTo={target ?? '/backoffice'} />
    </main>
  )
}
