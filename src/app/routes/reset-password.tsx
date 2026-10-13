import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { ResetPasswordForm } from '@/features/auth/components/reset-password-form'

export const Route = createFileRoute('/reset-password')({
  validateSearch: z.object({ token: z.string().min(1).max(256).optional() }),
  head: () => ({ meta: [{ title: 'Nova senha — Conferência do Diagnóstico' }] }),
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const { token } = Route.useSearch()
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7f9] p-6">
      {token ? <ResetPasswordForm token={token} /> : <p className="text-[14px] text-auster-gray">Link incompleto: falta o token na URL.</p>}
    </main>
  )
}
