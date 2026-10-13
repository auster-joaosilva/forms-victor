import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCurrentUser } from '@/features/auth/api/session'
import { ForgotPasswordForm } from '@/features/auth/components/forgot-password-form'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: async () => {
    if (await getCurrentUser()) throw redirect({ to: '/backoffice' })
  },
  head: () => ({ meta: [{ title: 'Esqueci a senha — Conferência do Diagnóstico' }] }),
  component: () => (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9] p-6">
      <ForgotPasswordForm />
    </main>
  ),
})
